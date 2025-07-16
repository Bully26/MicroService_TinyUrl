/*
what  this will do 
basically  receive all req from the gate way and put it in the rabbitmq queue
save the job status as pending

MAIN JOBS TO DO
- write a job in job queue
- write job status in redis cache [shared cache]
*/

require('dotenv').config({ path: "../.env" });
const express = require("express");
const axios = require("axios")
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const PORT = process.env.QUEUE_Service_port;
const amqp = require('amqplib');
const Redis = require("ioredis");
const { json } = require('stream/consumers');



let redis;
let connection;
let channel;
const exch = "write_job";
const rk = "send_job";

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

async function connect_all() {
  while (true) {
    try {
      console.log("trying to connect to RabbitMQ and Redis...");

      redis = new Redis({
        host: process.env.REDIS_HOST || 'redis',
        port: process.env.REDIS_PORT || 6379,
      });

      connection = await amqp.connect('amqp://rabbitmq');
      channel = await connection.createChannel();
      await channel.assertExchange(exch, "direct", { durable: false });
      await channel.assertQueue('job_q', { durable: false });
      await channel.bindQueue('job_q', exch, rk);

      console.log("Connected to Redis and RabbitMQ");
      break;
    } catch (err) {
      console.error("Connection failed:", err.message);
      await wait(3000);
    }
  }
}
connect_all();



app.post('/', async (req, res) => {

  const { id, url } = req.body;

  if (!id || !url) {
    res.status(400).send({
      success: false,
      message: "body was empty",
    })
  }

  const obj = {
    id: id,
    url: url
  };

  try {
    await channel.publish(exch, rk, Buffer.from(JSON.stringify(obj)));

    const redobj = {
      state: "pending",
      url: url
    }

    await redis.set(id, JSON.stringify(redobj), 'EX', 60 * 2);

  }
  catch (err) {
    req.status(400).send({
      message: "queue or redis error in write q"
    })

  }

  res.status(200).send({
    id: id,
    state: "pending"
  });
});
app.listen(PORT, () => {

  console.log(`QUEUE write service running on port ${PORT}`);

})