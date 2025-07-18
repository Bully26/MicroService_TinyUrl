require('dotenv').config({ path: '../.env' });
const { error } = require('console');
const { randomUUID } = require('crypto');
const express = require('express')
const axios = require('axios')


const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.GATEWAY_PORT;

app.post('/add', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const clientuid = randomUUID();

  try {
    const response = await axios.post('http://write:2000', {
      id: clientuid,
      url: url
    });

    console.log('Successful write request:', response.data);

  
    res.status(200).json({ id: clientuid, message: 'Data forwarded successfully' });

  } catch (error) {
    console.error('Error occurred while calling writer service:', error);

    res.status(500).json({ error: 'Failed to forward data to writer service' });
  }
});


app.post('/check', async (req, res) => {
  const { id , url } = req.body; 

  if (!id || !url) {
    return res.status(400).json({ success: false, message: 'Missing id or url' });
  }

  try {
    const {data} = await axios.post('http://read:2500/check', {
      id:id,
      url:url
    });

    
    if (data.state == 'pending') {
      return res.json({ state: 'pending' });
    }

    if (data.state == 'completed') {
      console.log(data);
      return res.json({ state: 'completed', url: data.url , surl:data.surl });
    }

    return res.status(500).json({
      success: false,
      message: 'Something went wrong on Writer service',
      error: 'Unknown state'
    });

  } catch (error) {
    console.error('Axios error:', error);
    return res.status(502).json({
      success: false,
      message: 'API Gateway error',
      error: error
    });
  }
});


app.get('/go/:surl', async (req, res) => {
  const surl = req.params.surl;

  try {
    const response = await axios.post('http://read:2500/go', {
      surl:surl
    });

    const { data } = response; 

    if (data.url) {
      return res.status(200).send({ url: data.url });
    } else {
      return res.status(404).json({
        success: false,
        message: "URL not found",
        error: "API Gateway: URL missing from writer response"
      });
    }

  } catch (error) {
    console.error('Gateway error:', error);

    return res.status(502).json({
      success: false,
      message: "Unknown error from writer service",
      error: error
    });
  }
});









app.listen(PORT,'0.0.0.0', () => {

    console.log('GateWay Service Running on port ', JSON.stringify(PORT));
})