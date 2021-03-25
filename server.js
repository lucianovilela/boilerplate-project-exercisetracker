const express = require('express')
const app = express()
const bodyParser = require('body-parser');

const cors = require('cors')
const moment = require('moment');

const mongoose = require('mongoose');
var logger = require('morgan');


require('dotenv').config();
const Schema = mongoose.Schema;

var uri = `mongodb://admin:${process.env.DB_PASSWORD}@cluster0-shard-00-00.mrzgo.mongodb.net:27017,cluster0-shard-00-01.mrzgo.mongodb.net:27017,cluster0-shard-00-02.mrzgo.mongodb.net:27017/portaoeletronico?ssl=true&replicaSet=atlas-k6rsc8-shard-0&authSource=admin&retryWrites=true&w=majority`;

mongoose.connect(uri)

app.use(cors())
app.use(logger('dev'));

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});


//User Schema
const userSchema = new Schema({
    username: { type: String, required: true, unique: true }
});

const User = mongoose.model('user_freecamp', userSchema);


//Exercise Schema
const exerciseSchema = new Schema({
    userId: String,
    description: String,
    duration: Number,
    date: { type: Date, default: Date.now }
})

const Exercise = mongoose.model('Exercise', exerciseSchema);


//add a new user
app.post('/api/exercise/new-user', (req, res, next) => {
    const newUser = new User({ username: req.body.username });
    newUser.save((err, data) => {
        res.json({ _id: data._id, username: data.username });
    })
});

//get all users
app.get('/api/exercise/users', (req, res) => {
    User.find({})
        .select({ _id: 1, username: 1 })
        .exec((err, data) => {
            res.json(data);
        })
});

//add an exercise to a user
app.post('/api/exercise/add', async (req, res) => {
    console.log('info:', req.body);
    const user = await User.findById(req.body.userId);
    if (!user) return res.json({ message: 'User does not exist' });
    if (isNaN(req.body.duration * 1)) return res.json({ message: 'duration is invalid' });

    const newExercise = new Exercise({
        userId: req.body.userId,
        description: req.body.description,
        duration: req.body.duration,
        date: (req.body.date) ? new Date(req.body.date) : new Date()
    });
    try {

        newExercise.save((err, exerciseData) => {
            const returnObj = {
                _id: user._id,
                username : user.username,
                description: exerciseData.description,
                duration: exerciseData.duration,
                date:  moment(exerciseData.date).format('ddd MMM DD YYYY')
            };
            console.log(returnObj);
            res.json(returnObj);
        });

    } catch (error) {
        console.log(error);
        res.json(JSON.stringify(error));
    }

});

//get a log of user's exercises.
app.get('/api/exercise/log', (req, res) => {
    const limit = req.query.limit || 10;
    const query = {
        userId: req.query.userId
    };

    if (req.query.from) {
        const startDate = new Date(req.query.from);
        query.date = { $gte: startDate  };
    }

    if (req.query.to) {
        const endDate = new Date(req.query.to);
        query.date.$lte = endDate 
    }

    //Get the exercises
    Exercise.find(query)
        .limit(parseInt(limit))
        .exec((err, exerciseData) => {
            console.log(exerciseData);
            const count = (exerciseData !== undefined) ? exerciseData.length : 0;
            //find the user and add exercises;
            User.findOne({}, (err, userData) => {
                if (err) res.json({ message: 'No such user' })
                else res.json({ _id: userData._id, username: userData.username, count: count, log: exerciseData });
            });
        });

})

// Not found middleware
app.use((req, res, next) => {
    return next({ status: 404, message: 'not found' })
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
