
/*
so what this worker does
basically it works as follows 
--> open the queue where all job are posted 
--> pickout 1 job send ackknowledgement 
--> completes the job [generate surl and save it to db]
--> change the status of job in redis cache 
*/

/*
THE SHORT URL GENERATER FUNCTION 
ok lets assume our link expire in    : 30 days
redirect per day                     : 1,000,000 
read:write ration                    : 100:1;
write requestion                     : 10000 write request per day
  content of write req:
    short url :
      for short url total number we need is
      10000 write req * 30 = 300,000 
      300000 unique names with there long url
      max size possible of url = 2,048 characters  taking 2100 size for long url 
      for short lets use 
      a-z A-Z 0-9 total 26*2+10 = 62 
      we want atleat logbase63(300000) chacracter 
      so we need 3.06 char lets take 6 character for better collison avoidance

      total storage req = 300000 * (6+2100) * (1 byte)*(1.15) 15 percent more storage for safety
      0.676646 GB ohh dym so small lets take 10 gb also adding (metadata for row)
 

    long  url :

*/

require('dotenv').config({ path: "../.env" });
const amqp = require('amqplib')
const axios = require("axios")
const PORT = process.env.WriteDb;
const Redis = require("ioredis");

redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
});

const { MongoClient, ServerApiVersion } = require('mongodb');


const MONGODB_URI = "mongodb://mongo:27017";
const DB_NAME = process.env.DB_NAME || 'myKeyValueDB';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'kv_store';

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

function getRandomInt() {


  min = Math.ceil(0);
  max = Math.floor(26 * 2 + 10 - 1);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


const generate_url = () => {
  let avail_char = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  let surl = "";
  for (let i = 0; i < 6; i++) {
    let num = getRandomInt();
    surl += avail_char[num];
  }

  return surl;
}
let db;
let collection;

let connection;
let channel;

async function connectbro() {
  while (true) {
    try {
      await client.connect();
      db = client.db(DB_NAME);
      collection = db.collection(COLLECTION_NAME);

      connection = await amqp.connect('amqp://rabbitmq');
      channel = await connection.createChannel();
      await channel.assertQueue('job_q', { durable: false });
      channel.prefetch(1);

      console.log("Connected to MongoDB and RabbitMQ.");
      return;
    } catch (err) {
      console.error(" Error while connecting [worker]:", err);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}



async function work() {
  try {
    await connectbro();
    channel.consume('job_q', async (msg) => {

      console.log(msg);

      const obj = JSON.parse(msg.content.toString());
      // contain id and long url
      let surl;
      while (true)// right surl is not found
      {
        surl = generate_url();
        let res;
        res = await collection.findOneAndUpdate(
          { short: surl },
          { $setOnInsert: { long: obj.url } },
          { upsert: true, returnDocument: "after" }
        );

        if (res.long == obj.url) break;
      }

      // job done not set pending status of client id set to completed 
      await redis.set(obj.id,
        JSON.stringify(
          {
            state: "completed",
            url: obj.url,
            surl: surl
          }
        ), "EX", 60
      );

      channel.ack(msg);
    }, {
      noAck: false
    })


  }
  catch (err) {
    // await connection.close();
    // await redis.quit();
    // await client.close();
    console.log('error occucred while writing db', err);
  }

}

work();
