'use strict';

const express = require('express');
const app = express();

var cors = require('cors')

const bodyParser = require('body-parser');
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors())

class Server {

	serverInit(){
      app.listen(2025, () => {
      	// antes 3060
        console.log('servidor ejecutandose en el puerto 2020!');
      });
  	}
}

module.exports.app = app;
module.exports.express = express;
module.exports.Server = Server;
