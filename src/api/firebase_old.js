'use strict'

const restPost = require('./restPost.js');
const restGet = require('./restGet.js');

const path = require('path');
var haversine = require('haversine')
var admin = require("firebase-admin");
var serviceAccount = require("../database/new-server-firebase.json");
var post = new restPost.Post();
var get = new restGet.Get();


class FirebaseCheckEvents {

  initializeApp(){
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: "https://new-sicom.firebaseio.com"
    });
  }

  startCheckEvents(){
    var firebaseCheckEvents = new FirebaseCheckEvents();
    var db = admin.database();
    var ref = db.ref("/actividades");
	  //console.log("entra aqui");

    ref.on("child_added", function(snapshot) {
      console.log("entra aqui chid");
      let client = snapshot.key;
      let childClient = db.ref("/actividades/" + snapshot.key);

      childClient.on("child_changed", (changedChild) => {

        let changedActividad = changedChild.val();
        let client = changedActividad.cliente;
        let connection = null;
        new Promise((resolvePromiseChanged, rejectPromiseChanged) => {
          connection = post.connection(client);
          connection.connect((err) => {
            // if (err)reject(err);
            // console.log('CONNECTED TO:', client , '... for update');
            firebaseCheckEvents.getDatas(changedActividad, true)//promesa para obtener los datos, si hay imagen se crea
           .then((datasForInsert) => {//si la imagen se creo bien
                firebaseCheckEvents.insertOrUpdate(connection, changedActividad, datasForInsert, true)//promesa para insertar los datos que retorna la promesa anterior
                .then((resultInsert) => {
                  resolvePromiseChanged(resultInsert);
                }).catch((errorResultInsert) => {
                  resolvePromiseChanged(errorResultInsert);
                });//fin de la promesa insertOrUpdate
            }).catch((datasForInsert) => {//la imagen no se creo bien
                firebaseCheckEvents.insertOrUpdate(connection, changedActividad, datasForInsert)//promesa para insertar los datos que retorna la promesa anterior
                .then((resultInsert) => {
                  resolvePromiseChanged(resultInsert);
                }).catch((errorResultInsert) => {
                  rejectPromiseChanged(errorResultInsert);
                });//fin de la promesa insertOrUpdate
            });//fin de promesa getDatas

          });//end connect
        }).then((result) => {
          // console.log("result ", result);
          let countDatas = 0;
          if (result == 0) {
            db.ref('actividades/' + changedActividad.cliente).orderByValue().once("value",(snapshot) => {
              snapshot.forEach(function(data) {
                countDatas ++;
              });
            });
            if (countDatas > 1) {
              // console.log("Programing remove... ", changedChild.key);
              changedChild.ref.remove();
            }
          }
          connection.end();
          // console.log("finished actividad: ruta " , changedActividad.ruta);
        }).catch((err) => {
          connection.end();
          // console.log("error finished actividad: ruta " , changedActividad.ruta);
          // console.log(err);
        });//end Promise
      });//end child_changed

      childClient.on("child_added", (addActividad) => {
    console.log("id new actividad:");
        let _connection = null;
        let addActividadVal = addActividad.val();
        new Promise((resolvePromiseChild_added, rejectPromiseChild_added) => {
          console.log("id new actividad:2");
          _connection = post.connection(client);
         _connection.connect((err) => {
          //  if (err)reject(err,_connection);
          //  console.log("conected to ", client, " for insert");
          //  console.log('CLIENT:', client,' INSERT ','c_x_i:', addActividadVal.c_x_i,'c_y_i:', addActividadVal.c_y_i, 'fecha_i:',addActividadVal.fecha_i,'fecha_f:',addActividadVal.fecha_f,'ruta:', addActividadVal.ruta,'tienda:', addActividadVal.tienda);
           /*Create query for insert*/

           firebaseCheckEvents.getDatas(addActividadVal, false)//promesa para obtener los datos, si hay imagen se crea
          .then((datasForInsert)=>{//si la imagen se creo bien
            console.log("id new actividad:3");
               firebaseCheckEvents.insertOrUpdate(_connection, addActividadVal, datasForInsert, false)//promesa para insertar los datos que retorna la promesa anterior
               .then((resultInsert) => {
                console.log("id new actividad:4");
                 resolvePromiseChild_added(resultInsert);
               }).catch((errorResultInsert) => {
                console.log("id new actividad:5");
                 rejectPromiseChild_added(errorResultInsert);
               });//fin de la promesa insertOrUpdate
           }).catch((datasForInsert) => {//la imagen no se creo bien
            console.log("id new actividad:6");
               firebaseCheckEvents.insertOrUpdate(_connection, addActividadVal, datasForInsert, false)//promesa para insertar los datos que retorna la promesa anterior
               .then((resultInsert) => {
                console.log("id new actividad:7");
                 resolvePromiseChild_added(resultInsert);
               }).catch((errorResultInsert) => {
                console.log("id new actividad:8");
                 rejectPromiseChild_added(errorResultInsert);
               });//fin de la promesa insertOrUpdate
           });//fin de promesa getDatas
         });//fin de _connection.connect
        }).then((result) => {//end promise insert
          // console.log("id new actividad:", result);
          _connection.end();

        }).catch((err) => {
          _connection.end();
          // console.log(err);
        });
      });
    });
  }

  insertOrUpdate(_connection, addActividadVal, datasForInsert,isUpdate){
    console.log("entro a insertoruptade");
    return new Promise((resolve, reject) => {
      let query_insert = null;
      console.log("imgF:",datasForInsert.imgF);
      if (!datasForInsert.imgF) {
        query_insert = "\' \' ," +datasForInsert.c_x_i  + "," + datasForInsert.c_y_i + ",\'"+datasForInsert.fecha_i+"\',\'"+
                datasForInsert.fecha_f+"\',"+datasForInsert.c_x_f+","+datasForInsert.c_y_f+","+datasForInsert.usuarios_id_0+","+
                datasForInsert.tiendas_id_0+","+datasForInsert.id_incidencias+",\'"+datasForInsert.incidenciaE+"\', ";
      }else{
        query_insert = "\'"+datasForInsert.imgF+"\' ," +datasForInsert.c_x_i  + "," + datasForInsert.c_y_i + ",\'"+datasForInsert.fecha_i+"\',\'"+
                datasForInsert.fecha_f+"\',"+datasForInsert.c_x_f+","+datasForInsert.c_y_f+","+datasForInsert.usuarios_id_0+","+
                datasForInsert.tiendas_id_0+","+datasForInsert.id_incidencias+",\'"+datasForInsert.incidenciaE+"\', ";
      }

      if (isUpdate) {
        /*La actividad ya existe*/

        new Promise((resolvePromiseWaiting) => {
          setTimeout(resolvePromiseWaiting, 4*1000);
        }).then(() => {
          // console.log("update :::::::::::::::::::::::::", datasForInsert.fecha_i, " fecha_f:", datasForInsert.fecha_f);
          if (datasForInsert.fecha_f != "0000-00-00 00:00:00") {
            _connection.query("UPDATE actividades SET ? WHERE usuarios_id_0= "+datasForInsert.usuarios_id_0+" AND fecha_i = '"+ datasForInsert.fecha_i +"'",
            [datasForInsert], (errorUpdate, resultUpdate, fieldsUpdate) => {
              if (errorUpdate) reject(errorUpdate);
              resolve(0);
            });
          }else{
            _connection.query("UPDATE actividades SET imgF= ? WHERE usuarios_id_0= "+datasForInsert.usuarios_id_0+" AND fecha_i = '"+ datasForInsert.fecha_i +"'",
            [datasForInsert.imgF], (errorUpdateImg, resultUpdateImg, fieldsUpdateImg) => {
              if (errorUpdateImg) reject(errorUpdateImg);
              resolve(0);
            });
          }

        });
      }else{
        /*Obtener la distancia*/
        let start = {
          latitude: datasForInsert.c_y_i,
          longitude: datasForInsert.c_x_i
        }

        _connection.query("SELECT coordenadax, coordenaday FROM tiendas where id=" + datasForInsert.tiendas_id_0, (errTiendas, rowsTiendas, fieldsTiendas) => {
          if (errTiendas){
            // console.log(errTiendas)
            reject();
          }else{

            let distancia = haversine(start, {latitude: rowsTiendas[0].coordenadax, longitude: rowsTiendas[0].coordenaday}, {unit: 'meter'});

            query_insert += distancia;

            _connection.query("CALL insertActivitySICOM("+ query_insert +")",(err, re, fi) => {
                if (err)reject(err);
                /*si la consulta retorna el id de la nueva actividad*/
                if (re) {
                  if (re[0]) {
                    let rs = re[0];
                    resolve(rs[0]._lastId);
                  }else{
                    resolve(0);
                  }
                }
              });
          }
        });

      }

    });
  }

  getDatas(changedActividad, isChange){

    let id_incidencias = 1;
    let incidenciaE = '';
    let fecha_f= '';
    changedActividad.fecha_f == '' ? fecha_f = '0000-00-00 00:00:00' : fecha_f = changedActividad.fecha_f;

    if (changedActividad.incidencia) {
      incidenciaE = changedActividad.incidencia;
    }

    if (changedActividad.id_incidencia) {
      id_incidencias = changedActividad.id_incidencia;
    }

    let data = {
        imgF: changedActividad.imgF,
        c_x_i: changedActividad.c_x_i,
        c_y_i: changedActividad.c_y_i,
        fecha_i: changedActividad.fecha_i,
        fecha_f: fecha_f,
        c_x_f: changedActividad.c_x_f,
        c_y_f: changedActividad.c_y_f,
        usuarios_id_0: changedActividad.ruta,
        tiendas_id_0: changedActividad.tienda,
        id_incidencias: id_incidencias,
        incidenciaE: incidenciaE
      };

      return new Promise((resolve, reject) => {
        resolve(data);
      });
  }

  getDateTime(){
    return new Promise((resolve, reject) => {
      var currentdate = new Date();
      if (currentdate) {
        let datetime = "" + currentdate.getDate() + ""
                        + (currentdate.getMonth()+1)  + ""
                        + currentdate.getFullYear() + "-"
                        + currentdate.getHours() + ""
                        + currentdate.getMinutes() + "-"
                        + currentdate.getMilliseconds();

        resolve(datetime);
      }else{
        reject('error');
      }
    });
  }
}

module.exports.FirebaseCheckEvents = FirebaseCheckEvents;
