const mongoose = require('mongoose');
const debuglog = require('debug')('mongo:')

mongoose.connect(`${process.env.MONGOURI}?retryWrites=true&w=majority&appName=Cluster`)

const db = mongoose.connection

db.on('open', () => debuglog('Connected to Database...'))

db.on('error', err => debuglog(err))

module.exports = db;