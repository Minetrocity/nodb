var nodb = require('../index');

var config = {
  db: {
    location: __dirname + 'nodb/',
    timeout: 100
  }
};

var db = nodb(config);
// db.writeData('test', 'key', 'value').then(function () {
//   console.log('ok');
// }, function (err) {
//   console.log(err);
// });

// db.readData('test', 'key').then(function (data) {
//   console.log(data);
// });

// db.readData('test', 'key2').then(function (data) {
//   console.log(data);
// });

// db.readData('test', 'key3', 'default').then(function (data) {
//   console.log(data);
// });

// db.writeData('test2', 'key', 'value').then(function () {
//   db.writeData('test2', 'key2', 'value2');
// }, function (err) {
//   console.log(err);
// });

db.writeData('test3', 'key', 'value').then(function () {
  setTimeout(function () {}, 1000);
});
