
require('dotenv').config({ path: '../.env' });
const express = require("express");
const axios = require("axios")
const app = express();
const PORT = process.env.READ_SERVICE_PORT;
const Redis = require("ioredis");
/*
Sends a client id with url
check in redis if the job is done or not 
redirect of existing url
*/
const redis = new Redis({
    host: process.env.REDIS_HOST || 'redis',
    port: process.env.REDIS_PORT || 6379,
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const { MongoClient, ServerApiVersion } = require('mongodb');


const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017';
const DB_NAME = process.env.DB_NAME || 'myKeyValueDB';
const COLLECTION_NAME = process.env.COLLECTION_NAME || 'kv_store';

const client = new MongoClient(MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
const clien_con = async () => {
    await client.connect();
}
clien_con();


const db = client.db(DB_NAME); // 1. Get your database
const collection = db.collection(COLLECTION_NAME);


app.post('/check', async (req, res) => {

    const { id, url } = req.body;

    // simply check in redis and return the state
    const data = await redis.get(id);
    const redobj = JSON.parse(data);
    console.log(redobj);
    try {
        if (redobj == "" || redobj == null) {
            res.status(401).send({
                "error": "PLEASE RETRY OBJECT DOEST EXIST IN CACHE"
            })
            return;

        }
        if (redobj.state == "pending") {
            res.status(200).send({
                state: redobj.state,
                url: redobj.url
            })
        } else if (redobj.state == "completed") {
            res.status(200).send({
                state: redobj.state,
                url: redobj.url,
                surl: redobj.surl
            })

        }
        return;
    } catch (err) {
        res.status(401).send({
            "error": "PLEASE RETRY OBJECT DOEST EXIST IN CACHE"
        })
        return;
    }

});

app.post('/go', async (req, res) => {

    const { surl } = req.body;
    console.log(surl);

    const out = await redis.get(surl);
    console.log(out);
    if (out == null) {
        console.log("first block");
        const data = await collection.findOne({ short: surl });
        console.log(data);
        if (data !== null && data.long) {
            await redis.set(surl, data.long);
            res.status(200).send({
                url: data.long
            });
        } else {
            res.status(404).send({
                success: false,
                message: "THIS  URL DOEST EXIST"
            })
        }



    } else {
        res.status(200).send({
            url: out
        })
    }



});


app.listen(PORT, () => {
    console.log(`reading service running PORT ${PORT}`);
})






