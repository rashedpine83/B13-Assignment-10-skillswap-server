const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;
// const dns = require("dns");
// dns.setServers(["8.8.8.8", "8.8.4.4"]);

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // await client.connect();
    const database = client.db("skillswap");
    const taskCollection = database.collection("tasks");
    const clientCollection = database.collection("client");
    const userCollection = database.collection("user");

    app.get("/api/tasks", async (req, res) => {
      const cursor = taskCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/tasks/:id", async (req, res) => {
      const { id } = req.params;

      const result = await taskCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });

    app.get("/api/tasks", async (req, res) => {
      const query = {};
      if (req.query.emailId) {
        query.emailId = req.query.emailId;
      }
      if (req.query.status) {
        query.status = req.query.status;
      }
      const cursor = taskCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    // app.get("/api/tasks/:email", async (req, res) => {
    //   const { email } = req.params;
    //   const query = { emailId: email };
    //   const result = await taskCollection.find(query).toArray();
    //   res.send(result);
    // });

    app.get("/api/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.findOne(query);
      res.send(result);
    });

    app.post("/api/tasks", async (req, res) => {
      try {
        const task = req.body;

        const result = await taskCollection.insertOne(task);
        console.log(task, result);
        res.status(201).json({
          success: true,
          insertedId: result.insertedId,
          message: "Task created successfully",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    app.patch("/api/tasks/:id", async (req, res) => {
      const { id } = req.params;

      const updateData = req.body;
      const result = await taskCollection.updateOne(
        { _id: new ObjectId(id) },
        {
          $set: {
            ...updateData,
          },
        },
      );
      res.send(result);
    });

    app.delete("/api/tasks/:id", async (req, res) => {
      const { id } = req.params;
      const result = await taskCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
