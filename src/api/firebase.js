'use strict'

const restPost = require('./restPost.js');
const restGet = require('./restGet.js');

const path = require('path');
var haversine = require('haversine')
var admin = require("firebase-admin");
const serviceAccount = require('../database/sicom-firebase.json');
//admin.initializeApp();
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

var post = new restPost.Post();
var get = new restGet.Get();


class FirebaseCheckEvents {
  startCheckEvents(){
    var firebaseCheckEvents = new FirebaseCheckEvents();
    db.listCollections().then(snapshot=>{
      snapshot.forEach(snaps=>{
        console.log(snaps["_queryOptions"].collectionId);  // GET LIST OF ALL COLLECTIONS
        db.collection(snaps["_queryOptions"].collectionId).onSnapshot(function(snapshot) {
          snapshot.docChanges().forEach(function(change) {
              if (change.type === "added") {
                  console.log("id new actividad:");
                  let _connection = null;
                  new Promise((resolvePromiseChild_added, rejectPromiseChild_added) => {
                    console.log("id new actividad:2");
                    _connection = post.connection(snaps["_queryOptions"].collectionId);
                    _connection.connect((err) => {
                      //no habia if
                      // if (err) {
                      //   console.error('Error al conectar a la base de datos:', err);
                      //   reject(err); // Rechazar la Promesa en caso de error de conexión
                      //   return;
                      // }
                      firebaseCheckEvents.getDatas(change.doc.data(), false)//promesa para obtener los datos, si hay imagen se crea
                      .then((datasForInsert)=>{//si la imagen se creo bien
                          console.log("id new actividad:3");
                          firebaseCheckEvents.insertOrUpdate(_connection, change.doc.data(), datasForInsert, false)//promesa para insertar los datos que retorna la promesa anterior
                        .then((resultInsert) => {
                          console.log("id new actividad:4");
                          resolvePromiseChild_added(resultInsert);
                        }).catch((errorResultInsert) => {
                          console.log(errorResultInsert);
                          console.log("id new actividad:5");
                          rejectPromiseChild_added(errorResultInsert);
                        });//fin de la promesa insertOrUpdate
                      }).catch((datasForInsert) => {//la imagen no se creo bien
                        console.log("id new actividad:6");
                        firebaseCheckEvents.insertOrUpdate(_connection, change.doc.data(), datasForInsert, false)//promesa para insertar los datos que retorna la promesa anterior
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
                    _connection.end();
                  }).catch((err) => {
                    _connection.end();
                  });
              }
              if (change.type === "modified") {
                //console.log("Modified city: ", change.doc.data());
                console.log("modified");
                let connection = null;
                new Promise((resolvePromiseChanged, rejectPromiseChanged) => {
                  connection = post.connection(snaps["_queryOptions"].collectionId);
                  console.log("esta aqui despues de conexion");
                    connection.connect((err) => {
                      //no habia if
                      // if (err) {
                      //   console.error('Error al conectar a la base de datos:', err);
                      //   reject(err); // Rechazar la Promesa en caso de error de conexión
                      //   return;
                      // }
                      console.log("entra a conect y hara get datas");
                      firebaseCheckEvents.getDatas(change.doc.data(), true)//promesa para obtener los datos, si hay imagen se crea
                      .then((datasForInsert) => {//si la imagen se creo bien
                        console.log("entra si se creo bien la imagen");
                        firebaseCheckEvents.insertOrUpdate(connection, change.doc.data(), datasForInsert, true)//promesa para insertar los datos que retorna la promesa anterior
                        .then((resultInsert) => {
                          console.log("Entra para isertr los datos");
                          resolvePromiseChanged(resultInsert);
                        }).catch((errorResultInsert) => {
                          console.log("Es el catch del inseet de los datos");
                          resolvePromiseChanged(errorResultInsert);
                        });//fin de la promesa insertOrUpdate
                      }).catch((datasForInsert) => {//la imagen no se creo bien
                        console.log("Es el catch de la imagen que no se creo bien");
                        firebaseCheckEvents.insertOrUpdate(connection, change.doc.data(), datasForInsert)//promesa para insertar los datos que retorna la promesa anterior
                        .then((resultInsert) => {
                          console.log("El then del proceso en la imagen que no se creo bien");
                          resolvePromiseChanged(resultInsert);
                        }).catch((errorResultInsert) => {
                          console.log("Y el catch del proceso de no crearse bien la img");
                          rejectPromiseChanged(errorResultInsert);
                        });//fin de la promesa insertOrUpdate
                      });//fin de promesa getDatas
                    });//end connect
                }).then((result) => {
                  let countDatas = 0;
                  console.log("que trae result");
                  console.log(result);
                  if (result === 0) {
                    console.log("Documento a eliminar "+change.doc.id);
                    db.collection(snaps["_queryOptions"].collectionId).doc(change.doc.id).delete().then(function() {
                      console.log("Document successfully deleted!");
                    }).catch(function(error) {
                      console.error("Error removing document: ", error);
                    });  
                  }
                connection.end();
                }).catch((err) => {
                  connection.end();
                });//end Promise
              }
              if (change.type === "removed") {
                  //console.log("Removed city: ", change.doc.data());
                  console.log("removed");
              }
          });
        });
      })
    }).catch(error=>console.log(error));
  }

  getDatas(changedActividad, isChange){

    let id_incidencias = 1;
    let incidenciaE = '';
    let fecha_f= '';

    let conPin = changedActividad.conPIN ? changedActividad.conPIN : false;

    changedActividad.fecha_f == '' ? fecha_f = '0000-00-00 00:00:00' : fecha_f = changedActividad.fecha_f;
    //changedActividad.fecha_f == '' ? fecha_f = '0000-00-00-00-00-00' : fecha_f = changedActividad.fecha_f;

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
        usuario_id: changedActividad.ruta,
        tienda_id: changedActividad.tienda,
        id_incidencias: id_incidencias,
        incidenciaE: incidenciaE,
        conPin: conPin
      };

      return new Promise((resolve, reject) => {
        resolve(data);
      });
  }

  insertOrUpdate(_connection, addActividadVal, datasForInsert,isUpdate){
    console.log("entro a insertoruptade");
    return new Promise((resolve, reject) => {
      let query_insert = null;
      if (!datasForInsert.imgF) {
        query_insert = "\' \' ," +datasForInsert.c_x_i  + "," + datasForInsert.c_y_i + ",\'"+datasForInsert.fecha_i+"\',\'"+
                datasForInsert.fecha_f+"\',"+datasForInsert.c_x_f+","+datasForInsert.c_y_f+","+datasForInsert.usuario_id+","+
                datasForInsert.tienda_id+","+datasForInsert.id_incidencias+",\'"+datasForInsert.incidenciaE+ "\', " + datasForInsert.conPin;
      }else{
        query_insert = "\'"+datasForInsert.imgF+"\' ," +datasForInsert.c_x_i  + "," + datasForInsert.c_y_i + ",\'"+datasForInsert.fecha_i+"\',\'"+
                datasForInsert.fecha_f+"\',"+datasForInsert.c_x_f+","+datasForInsert.c_y_f+","+datasForInsert.usuario_id+","+
                datasForInsert.tienda_id+","+datasForInsert.id_incidencias+",\'"+datasForInsert.incidenciaE+ "\', " + datasForInsert.conPin;
      }

      if (isUpdate) {
        //La actividad ya existe
        console.log("entro a isUpdate");

        new Promise((resolvePromiseWaiting) => {
          setTimeout(resolvePromiseWaiting, 4*1000);
        }).then(() => {
          if (datasForInsert.fecha_f != "0000-00-00 00:00:00") {
            _connection.query("UPDATE actividades SET ? WHERE usuario_id = "+datasForInsert.usuario_id+" AND fecha_i = '"+ datasForInsert.fecha_i +"'",
            [datasForInsert], (errorUpdate, resultUpdate, fieldsUpdate) => {
              if (errorUpdate) reject(errorUpdate);
              // if (errorUpdate) {
              //     console.error('Error con query isUpdate:', errorUpdate);
              //     reject(errorUpdate); // Rechazar la Promesa en caso de error de conexión
              //     return;
              // }
              resolve(0);
            });
          }else{
            _connection.query("UPDATE actividades SET imgF= ? WHERE usuario_id = "+datasForInsert.usuario_id+" AND fecha_i = '"+ datasForInsert.fecha_i +"'",
            [datasForInsert.imgF], (errorUpdateImg, resultUpdateImg, fieldsUpdateImg) => {
              if (errorUpdateImg) reject(errorUpdateImg);
              // if (errorUpdate) {
              //     console.error('Error con query fecha_f == 0000-00-00...:', errorUpdate);
              //     reject(errorUpdate); // Rechazar la Promesa en caso de error de conexión
              //     return;
              // }
              resolve(0);
            });
          }

        });
      }else{
        //La actividad no existe
        console.log("va a imprimir el query");
        console.log(query_insert);
        console.log("va a imprimir el query final");
        _connection.query("CALL insertActivitySICOM("+ query_insert +")",(err, re, fi) => {
          if (err)reject(err);
          // if (err) {
          //   console.error('Error con query no Isupdate:', err);
          //   reject(err); // Rechazar la Promesa en caso de error de conexión
          //   return;
          // }
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
}

module.exports.FirebaseCheckEvents = FirebaseCheckEvents;
