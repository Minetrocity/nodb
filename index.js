/**
 * Written By: Richie Preece <richie.preece@gmail.com>
 * Copyright: 2015 Minetrocity
 * License: MIT
 */

/**
 * Config file should be as follows:
 * {
 *   db: {
 *     location: '/path/to/databases', // Location of the .db.json files
 *     timeout: 10000, // Time to auto-close database (default: 300000 -- 5 min, -1 = never close)
 *     fileTimeout: 500 // Time to limit fs actions in milliseconds (default: -1 -- no limit)
 *   }
 * }
 */

var q = require('q');
var fs = require('fs');
var mkdirp = require('mkdirp');

var globalConfig;
var ready;
var databases = {};
var timeouts = {};
var writing = {};

/**
 * Constructor for module
 *
 * @param  {object} config Config file
 * @return {object} Available API
 */
module.exports = function (config) {
  globalConfig = verifyConfig(config);
  ready = createLocation();

  return {
    writeData: writeData,
    readData: readData
  };
};

/**
 * Takes a database name, key, and value. It stores the value
 * in the database under the key, and writes database to a file (if allowed)
 *
 * @param  {string}   database Databae name you'd like to open
 * @param  {string}   key      Key to store the data under
 * @param  {anything} value    Value to store under the key
 * @return {promise} Denotes success or failure
 */
function writeData (database, key, value) {
  var deferred = q.defer();

  // We need to verify that the database is open and ready
  openDatabase(database).then(function () {
    // Set the key/value pair
    databases[database][key] = value;

    // Ask for a write
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

/**
 * Takes a database name, and key. It returns the data stored in the database
 * under the specified key (or defaultValue if it doesn't exist)
 *
 * @param  {string}   database     Database name you'd like to open
 * @param  {string}   key          Key to retrieve data from
 * @param  {anything} defaultValue The default return if no data is found for key
 * @return {promise} Data is returned as first argument to success callback
 */
function readData (database, key, defaultValue) {
  var deferred = q.defer();

  // We need to verify that the database is open and ready
  openDatabase(database).then(function () {
    // Return data, or, defaultValue if no data is found
    deferred.resolve(databases[database][key] || defaultValue);
  }, function (err) {
    deferred.reject(err);
  });

  return deferred.promise;
}

/**
 * Request to write database to file (writing to fs can be limited in config)
 *
 * @param  {string} database Database to write
 * @return {Promise} Denotes success or failure of write
 */
function requestWrite (database) {
  var deferred = q.defer();

  // Is the database currently being written?
  if(writing[database]) {
    deferred.reject('Database is being written');
    return deferred.promise();
  }

  writing[database] = true;

  // Write the database
  write(database).then(function () {
    deferred.resolve();
  }, function (err) {
    deferred.reject(err);
  });

  var time = globalConfig.db.fileTimeout;

  if(time <= 0) {
    // If there's no time limit for writing, then clear out block
    delete writing[database];
  } else {
    // If there's a time limit, wait for time to pass and remove block
    setTimeout(function () {
      delete writing[database];
    }, time);
  }

  return deferred.promise;
}

/**
 * Writes a database to file
 *
 * @param  {string} database Database to write
 * @return {promise} Denotes success or failure of write
 */
function write (database) {
  var deferred = q.defer();

  // Write database to file under database name
  fs.writeFile(globalConfig.db.location + database + '.db.json', JSON.stringify(databases[database]), function (err) {
    if(err) return deferred.reject(err);

    deferred.resolve();
  });

  return deferred.promise;
}

/**
 * Verifies the needed config options are available
 *
 * @param  {object} config Configuration object
 * @return {object} Returns the properly adjusted config object
 */
function verifyConfig (config) {
  config = config || {};
  config.db = config.db || {};
  config.db.location = config.db.location || __dirname + 'databases/'; // /cwd/databases/ default
  config.db.timeout = config.db.timeout || 1000 * 60 * 5; // 5 minute default
  config.db.fileTimeout = config.db.fileTimeout || -1; // No limit default

  return config;
}

/**
 * Verifies the database location exists
 *
 * @return {promise} Denotes success or failure of folder creation
 */
function createLocation () {
  var deferred = q.defer();

  // Make the directory, and report status
  mkdirp(globalConfig.db.location, function (err, made) {
    if(err) return deferred.reject(err);

    deferred.resolve(made);
  });

  return deferred.promise;
}

/**
 * Opens a database (creates one if non-existent)
 *
 * @param  {string} name Name of database
 * @return {promise} Denotes success of opening database
 */
function openDatabase (name) {
  var deferred = q.defer();

  // Make sure the file directory exists
  ready.then(function () {
    // Make note of an action on the database to avoid closing early
    actionOn(name);

    // If database exists in memory already, we're good to go
    if(databases[name]) return deferred.resolve();

    // If database isn't in memory, make sure it exists
    createDatabase(name).then(function () {
      // Read database
      fs.readFile(globalConfig.db.location + name + '.db.json', function (err, data) {
        if(err) return deferred.reject(err);

        // Hold database in memory
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

/**
 * Checks for existence of a database, creates if non-existent
 *
 * @param  {string} name Name of database to open
 * @return {promise} Denotes existence of database
 */
function createDatabase (name) {
  var deferred = q.defer();

  // Make sure the database location exists
  ready.then(function () {
    // Check if database exists
    fs.exists(globalConfig.db.location + name + '.db.json', function (exists) {
      if(exists) return deferred.resolve();

      // If database is non-existent, simply write an empty object as placeholder
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

/**
 * Closes a database and writes to file
 *
 * @param  {[type]}
 * @return {[type]}
 */
function closeDatabase (name) {
  var deferred = q.defer();

  // We need to be sure the database location exists
  ready.then(function () {
    clearTimeout(timeouts[name]);

    // Write to file
    write(name).then(function () {
      // Remove database from memory
      delete databases[name];

      deferred.resolve();
    }, function (err) {
      deferred.reject(err);
    });
  }, function () {
    deferred.reject('Database couldn\'t instantiate');
  });

  return deferred.promise;
}

/**
 * Logs actions to the database, and preps for auto-close if specified
 *
 * @param  {string} name Database with action
 */
function actionOn (name) {
  // Clear a possibly existing timeout
  clearTimeout(timeouts[name]);

  // Make sure user hasn't declined auto-close
  if(globalConfig.db.timeout < 0) return;

  // Set up auto-close
  timeouts[name] = setTimeout(function () {
    closeDatabase(name);
  }, globalConfig.db.timeout);
}
