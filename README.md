![Travis Status](https://travis-ci.org/Minetrocity/nodb.svg?branch=master)

# nodb
A localized document-based database

## Install
`npm install --save minetrocity-nodb`

## Use
```
var nodb = require('minetrocity-nodb');

var config = {
  db: {
    location: __dirname + 'databases/', //Path to db folder
    timeout: 1000 * 60 * 3, //Time to auto-close db (default: 300000 = 5 min; -1 = no auto-close)
    fileTimeout: 500, //Only allow fs operations once per millis (default: -1 = no limit)
  }
}

var bob = {
  name: 'Bob',
  age: 20
};

nodb.writeData('users', 'bob', bob).then(function () {
  console.log('Bob saved to database');
});

//Elsewhere

nodb.readData('users', 'bob').then(function (data) {
  console.log('Hello,', data.name); // Hello, bob
});
```
