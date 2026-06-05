const { WebcastPushConnection } = require('tiktok-live-connector');

const tiktokLive = new WebcastPushConnection('xyojansaidx');

tiktokLive.connect()
  .then(state => {
    console.log('CONECTADO');
    console.log(state);
  })
  .catch(err => {
    console.log('ERROR');
    console.log(err);
  });