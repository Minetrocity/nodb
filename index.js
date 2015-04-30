var q = require('q');
var fs = require('fs');
var mkdirp = require('mkdirp');

/**
 * Config file should contain the following:
 * {
 *   db: {
 *     location: 'path/to/database/folder',
 *     timeout: 400, //Time to timeout database (will close database at time since last operation), default: 5 minutes, -1 = no timeout
 *     fileTimeout: 500 //Allow writing to a file every x milliseconds, defaults to -1 (no limit)
 *   }
 * }
 */

var globalConfig;
var ready;
var databases = {};
var timeouts = {};
var writing = {};

module.exports = function (config) {
  globalConfig = verifyConfig(config);
  ready = createLocation();

  return {
    writeData: writeData,
    readData: readData
  };
};

function writeData (database, key, value) {
  var deferred = q.defer();

  openDatabase(database).then(function () {
    databases[database][key] = value;

    requestWrite(database).then(function () {
      deferred.resolve();
    }, function (err) {
      deferred.reject(err);
    });
  }, function (err) {
    deferred.reject(err);
  });

  return deferred.promise;
}

function requestWrite (database) {
  var deferred = q.defer();

  if(writing[database]) return deferred.reject('Database is being written');

  writing[database] = true;

  write(database).then(function () {
    deferred.resolve();
  }, function (err) {
    deferred.reject(err);
  });

  var time = globalConfig.db.fileTimeout;

  if(time <= 0) {
    delete writing[database];
  } else {
    setTimeout(function () {
      delete writing[database];
    }, time);
  }


  return deferred.promise;
}

function write (database) {
  var deferred = q.defer();

  fs.writeFile(globalConfig.db.location + database + '.db.json', JSON.stringify(databases[database]), function (err) {
    if(err) return deferred.reject(err);

    deferred.resolve();
  });

  return deferred.promise;
}

function readData (database, key, defaultValue) {
  var deferred = q.defer();

  openDatabase(database).then(function () {
    deferred.resolve(databases[database][key] || defaultValue);
  }, function (err) {
    deferred.reject(err);
  });

  return deferred.promise;
}

function verifyConfig (config) {
  config = config || {};
  config.db = config.db || {};
  config.db.location = config.db.location || __dirname + 'databases/';
  config.db.timeout = config.db.timeout || 1000 * 60 * 5;
  config.db.fileTimeout = config.db.fileTimeout || -1;

  return config;
}

function createLocation () {
  var deferred = q.defer();

  mkdirp(globalConfig.db.location, function (err, made) {
    if(err) return deferred.reject(err);

    deferred.resolve(made);
  });

  return deferred.promise;
}

function openDatabase (name) {
  var deferred = q.defer();

  ready.then(function () {
    actionOn(name);

    if(databases[name]) return deferred.resolve();

    createDatabase(name).then(function () {
      fs.readFile(globalConfig.db.location + name + '.db.json', function (err, data) {
        if(err) return deferred.reject(err);

        databases[name] = JSON.parse(data);

        deferred.resolve();
      });
    }, function (err) {
      deferred.reject(err);
    });
  }, function () {
    deferred.reject('Database couldn\'t instantiate');
  });

  return deferred.promise;
}

function createDatabase (name) {
  var deferred = q.defer();

  ready.then(function () {
    fs.exists(globalConfig.db.location + name + '.db.json', function (exists) {
      if(exists) return deferred.resolve();

      fs.writeFile(globalConfig.db.location + name + '.db.json', '{}', function (err) {
        if(err) return deferred.reject('Database couldn\'t create table');

        return deferred.resolve();
      });
    });
  }, function () {
    deferred.reject('Database couldn\'t instantiate');
  });

  return deferred.promise;
}

function closeDatabase (name) {
  var deferred = q.defer();

  console.log('close database');

  ready.then(function () {
    clearTimeout(timeouts[name]);

    fs.writeFile(globalConfig.db.location + name + '.db.json', JSON.stringify(databases[name]), function (err) {
      if(err) return deferred.reject('Couldn\'t write database table');

      delete databases[name];

      return deferred.resolve();
    });
  }, function () {
    deferred.reject('Database couldn\'t instantiate');
  });

  return deferred.promise;
}

function actionOn (name) {
  clearTimeout(timeouts[name]);

  if(globalConfig.db.timeout < 0) return;

  timeouts[name] = setTimeout(function () {
    closeDatabase(name);
  }, globalConfig.db.timeout);
}
