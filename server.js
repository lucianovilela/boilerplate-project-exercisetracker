const express = require('express')
const app = express()
const bodyParser = require('body-parser');

const cors = require('cors')
const moment = require('moment');

const mongoose = require('mongoose');

require('dotenv').config();
const Schema = mongoose.Schema;

console.log(process.env.DB_PASSWORD);
var uri = `mongodb://admin:${process.env.DB_PASSWORD}@cluster0-shard-00-00.mrzgo.mongodb.net:27017,cluster0-shard-00-01.mrzgo.mongodb.net:27017,cluster0-shard-00-02.mrzgo.mongodb.net:27017/portaoeletronico?ssl=true&replicaSet=atlas-k6rsc8-shard-0&authSource=admin&retryWrites=true&w=majority`;

mongoose.connect(uri )

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});


//User Schema
const userSchema = new Schema({
  username: {type: String, required: true, unique: true } 
});

const User = mongoose.model('User', userSchema);


//Exercise Schema
const exerciseSchema = new Schema({
  userId: String, 
  description: String, 
  duration: Number, 
  date: {type: String, required: false}
})

const Exercise = mongoose.model('Exercise', exerciseSchema);


//add a new user
app.post('/api/exercise/new-user', (req, res, next) => {
  const newUser = new User({ username: req.body.username });
  newUser.save((err, data) => {
    res.json({_id: data._id, username: data.username});
  })
});

//get all users
app.get('/api/exercise/users', (req, res) => {
  User.find({})
  .select({_id: 1, username: 1})
  .exec((err, data) => {
    res.json(data);
  })
});

//add an exercise to a user
app.post('/api/exercise/add', (req, res) => {
  console.log('Date:', req.body.date);
  const date = (req.body.date) ? new Date(req.body.date): new Date();
  const timestamp = Math.floor(date / 1000);
  
  const newExercise = new Exercise({
    userId: req.body.userId,
    description: req.body.description, 
    duration: req.body.duration,
    date: timestamp
  });
  
  User.findOne({_id: req.body.userId }, (err, userData) => {
    if(err) res.json({message: 'User does not exist'});
    newExercise.save((err, exerciseData) => {
      res.json({
        username: userData.username,
        description: exerciseData.description,
        duration: exerciseData.duration, 
        date: moment.unix(exerciseData.date).format('ddd MMM DD YYYY')
      });
    })
    
  });
})

//get a log of user's exercises.
app.get('/api/exercise/log/:userId/:from?/:to?/:limit?', (req, res) => {
  const query = {
    userId: req.params.userId
  };
  
  if(req.params.from) { 
    const startDate = new Date(req.params.from);
    query.date = { $gte: Math.floor(startDate / 1000)};
  }
  
  if(req.params.to) {
    const endDate = new Date(req.params.to);
    query.date.$lt = Math.floor(endDate / 1000)
  }
  
  //Get the exercises
  Exercise.find(query)
  .limit(parseInt(req.params.limit))
  .exec((err, exerciseData) => {
    console.log(exerciseData);
    const count = (exerciseData !== undefined) ? exerciseData.length : 0;
    //find the user and add exercises;
    User.findOne({}, (err, userData) => {
      if(err) res.json({message: 'No such user'}) 
      else res.json({_id: userData._id, username: userData.username, count: count, log: exerciseData});
    });
  });

})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
});

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage
  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
