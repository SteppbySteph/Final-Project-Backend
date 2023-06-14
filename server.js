import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import bcrypt from "bcrypt"
import crypto from "crypto"
import listEndpoints from "express-list-endpoints"
import sweden from "./sweden.json"
import europe from "./europe.json"
import worldwide from "./worldwide.json"

import 'dotenv/config'

const mongoUrl = process.env.MONGO_URL || "mongodb:localhost/test"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.set('strictQuery', true);
mongoose.Promise = Promise


const port = process.env.PORT || 8080
const app = express()

///////////////////////Middlewares/////////////////////
app.use(cors())
app.use(express.json())

///////////////////////Routes/////////////////////
app.get("/", (req, res) => {
  res.send(listEndpoints(app))
})

app.get("/test", (req, res) => {
  res.send("hello there from Final project SUP")
})

app.get("/sweden", (req, res) => {
  res.status(200).json({ success: true, response: sweden })
});

app.get("/europe", (req, res) => {
  res.status(200).json({
    data: europe,
    success: true
  });
});

app.get("/worldwide", (req, res) => {
  res.status(200).json({
    data: worldwide,
    success: true
  });
});

///////////////////////User section/////////////////////
const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    minlength: 8,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    match: /.+\@.+\..+/,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    trim: true
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex")
  }
})

const User = mongoose.model("User", UserSchema)

//create a user
app.post("/register", async (req, res) => {

  const { username, email, password } = req.body
  try {
    const salt = bcrypt.genSaltSync()

    if (username.length < 8) {
      res.status(400).json({
        response: "Username must be at least 8 characters long",
        success: false
      })
    } else {
      const newUser = await new User({
        username: username,
        email: email,
        password: bcrypt.hashSync(password, salt)
      }).save()
      res.status(201).json({
        response: {
          username: newUser.username,
          email: newUser.email,
          accessToken: newUser.accessToken,
          userId: newUser._id
        },
        success: true
      })
    }
  } catch (error) {
    res.status(400).json({
      response: "Something went wrong. Please check your credentials.",
      success: false
    })
  }
})

//delete a user  
app.delete("/users/:id", async (req, res) => {
  const { id } = req.params

  try {
    const deleted = await User.findOneAndDelete({ _id: id })
    if (deleted) {
      res.status(200).json({
        success: true,
        response: `User ${deleted.username} has been deleted.`
      })
    } else {
      res.status(404).json({
        success: false, response: "Not found"
      })
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      response: error
    })
  }
})

//update user
app.patch("/users/:id", async (req, res) => {
  const { id } = req.params
  const { updatedName } = req.body

  try {
    const userToUpdate = await User.findByIdAndUpdate({ _id: id }, { username: updatedName })
    if (userToUpdate) {
      res.status(200).json({
        success: true,
        response: `User ${userToUpdate.username} has been updated`
      })
    } else {
      res.status(404).json({
        success: false,
        response: "Not found"
      })
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      response: error
    })
  }
})

//endpoint for user login
app.post("/login", async (req, res) => {
  const { username, password, email } = req.body

  try {
    const user = await User.findOne({ username, email })

    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(200).json({
        success: true,
        username: user.username,
        email: user.email,
        accessToken: user.accessToken,
        userId: user._id
      })
    } else {
      res.status(400).json({
        response: "Credentials don't match",
        success: false
      })
    }
  } catch (error) {
    res.status(400).json({
      response: error,
      success: false
    })
  }
})

//use below to enter post section
const authenticateUser = async (req, res, next) => {
  const accessToken = req.header("Authorization")
  try {
    const user = await User.findOne({ accessToken: accessToken })
    if (user) {
      next();
    } else {
      res.status(401).json({
        response: "Please log in",
        success: false
      })
    }
  } catch (error) {
    res.status(400).json({
      response: error,
      success: false
    })
  }
}

///////////////////////Post section/////////////////////
const CreatorSchema = new mongoose.Schema({
  creatorId: String,
  name: String,
  email: String
})

const PostSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true,
    minlength: 5,
    maxlength: 1500,
  },
  likes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: () => new Date()
  },
  creator: {
    type: CreatorSchema,
    required: true
  }
})

const Post = mongoose.model("Post", PostSchema)

//if authenticated user  - get posts
app.get("/posts", authenticateUser)
app.get("/posts", async (req, res) => {
  const posts = await Post.find({}).sort({ createdAt: -1 })
  res.status(200).json({
    response: posts,
    success: true
  })
})

//create a post
app.post("/posts", authenticateUser)
app.post("/posts", async (req, res) => {
  const { message } = req.body
  const accessToken = req.header("Authorization")
  try {
    const queriedUser = await User.findOne({ accessToken })
    const newPost = await new Post({
      message: message,
      creator: {
        creatorId: queriedUser._id,
        name: queriedUser.username,
        email: queriedUser.email
      }
    }).save()
    res.status(201).json({
      response: newPost,
      success: true
    })
  } catch (error) {
    res.status(400).json({
      response: error,
      success: false
    })
  }
})

//update likes for a post
app.post("/posts/:id/likes", async (req, res) => {
  const { id } = req.params
  try {
    const postToUpdate = await Post.findByIdAndUpdate(id, { $inc: { likes: 1 } })
    res.status(200).json({
      response: `Likes for \'${postToUpdate.message}\' has been increased`,
      success: true
    })
  } catch (error) {
    res.status(400).json({
      response: error,
      success: false
    })
  }
})

//delete a post 
app.delete("/posts/:id", async (req, res) => {
  const { id } = req.params

  try {
    const deleted = await Post.findOneAndDelete({ _id: id })
    if (deleted) {
      res.status(200).json({
        success: true,
        response: `Post with this message \'${deleted.message}\' has been deleted.`
      });
    } else {
      res.status(404).json({
        success: false, response: "Not found"
      })
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      response: error
    })
  }
})

//update post message
app.patch("/posts/:id", async (req, res) => {
  const { id } = req.params
  const { updatedMessage } = req.body

  try {
    const postToUpdate = await Post.findByIdAndUpdate({ _id: id }, { message: updatedMessage })
    if (postToUpdate) {
      res.status(200).json({
        success: true,
        response: `Post with message \'${postToUpdate.message}\' has been updated`
      })
    } else {
      res.status(404).json({
        success: false,
        response: "Not found"
      })
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      response: error
    })
  }
})


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
