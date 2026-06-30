const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
require("dotenv").config();
const port = process.env.PORT || 8000;

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

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Unauthorized1" });
  }
  const token = authHeader?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized2" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

async function run() {
  try {
    // await client.connect();
    const database = client.db("skillswap");
    const taskCollection = database.collection("tasks");
    const proposalCollection = database.collection("proposals");
    const paymentCollection = database.collection("payments");
    const userCollection = database.collection("user");
    const reviewCollection = database.collection("reviews");
    const completedTaskCollection = database.collection("completedTasks");

    //compeleted task relate api
    app.get("/api/completed-tasks", async (req, res) => {
      const result = await completedTaskCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/completed-tasks", async (req, res) => {
      try {
        const completedTask = req.body;
        const result = await completedTaskCollection.insertOne(completedTask);
        res.status(201).json({
          success: true,
          insertedId: result.insertedId,
          message: "Completed task created successfully",
        });
      } catch (error) {
        console.log("SERVER ERROR:", error);
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    //review relate api
    app.get("/api/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    app.post("/api/reviews", async (req, res) => {
      try {
        const review = req.body;

        console.log("Received review:", review);

        const result = await reviewCollection.insertOne(review);

        res.send(result);
      } catch (error) {
        console.log("SERVER ERROR:", error);

        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Task Relate API
    app.get("/api/tasks", async (req, res) => {
      const { page = 1, limit = 12 } = req.query;

      const pageNum = Number(page);

      const limitNum = Number(limit);
      const skip = (pageNum - 1) * limitNum;

      const cursor = taskCollection
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const result = await cursor.toArray();
      const totalCount = await taskCollection.countDocuments({
        userId: req.user?.id,
      });
      const totalPages = Math.ceil(totalCount / Number(limit));
      res.send({ data: result, page: Number(page), totalPages, totalCount });
    });

    app.get("/api/tasks/email", async (req, res) => {
      const email = req.query.email;
      const result = await taskCollection
        .find({
          emailId: email,
        })
        .toArray();

      res.send(result);
    });

    app.get("/api/tasks/allTasks", async (req, res) => {
      const result = await taskCollection.find().toArray();
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
      const cursor = taskCollection
        .find(query)

        .sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/tasks/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.findOne(query);

      res.send(result);
    });

    app.post("/api/tasks", verifyToken, async (req, res) => {
      try {
        const task = req.body;
        const newTask = {
          ...task,
          createdAt: new Date(),
        };

        const result = await taskCollection.insertOne(newTask);
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

    // User Relate API

    app.post("/api/users", async (req, res) => {
      try {
        const user = req.body;

        if (!user.email || !user.name) {
          return res.status(400).send({
            success: false,
            message: "Name and email are required",
          });
        }

        const cleanUser = {
          name: user.name,
          email: user.email,
          role: user.role || "client",
          skills: Array.isArray(user.skills) ? user.skills : [],
          bio: user.bio || "",
          hourlyRate: Number(user.hourlyRate) || 0,
          status: "Active", // default status
          createdAt: new Date(),
        };

        const result = await userCollection.updateOne(
          { email: cleanUser.email },
          {
            $set: {
              name: cleanUser.name,
              role: cleanUser.role,
              skills: cleanUser.skills,
              bio: cleanUser.bio,
              hourlyRate: cleanUser.hourlyRate,
              status: cleanUser.status, // এখানে আনো
            },

            $setOnInsert: {
              email: cleanUser.email,
              createdAt: cleanUser.createdAt,
            },
          },
          { upsert: true },
        );
        res.status(201).send({
          success: true,
          insertedId: result.insertedId,
          message: "User saved successfully",
        });
      } catch (error) {
        console.error("USER CREATE ERROR:", error);

        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/api/users", async (req, res) => {
      const cursor = userCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/api/users/:id", async (req, res) => {
      const { id } = req.params;

      const result = await userCollection.findOne({
        _id: new ObjectId(id),
      });

      res.send(result || {});
    });

    //single user by email

    app.get("/api/users/:email", async (req, res) => {
      const { email } = req.params;

      const result = await userCollection.findOne({
        email,
      });

      res.send(result || {});
    });

    // update profile

    app.patch("/api/users/:email", async (req, res) => {
      const { email } = req.params;

      const data = req.body;

      const result = await userCollection.updateOne(
        {
          email,
        },
        {
          $set: data,
        },
        {
          upsert: true,
        },
      );

      res.send(result);
    });

    // Proposal Relate API

    app.get("/api/proposals", async (req, res) => {
      try {
        const result = await proposalCollection.find().limit(5).toArray();

        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch proposals",
          error: error.message,
        });
      }
    });

    app.get("/api/proposals/my-proposals", async (req, res) => {
      try {
        const result = await proposalCollection.find().toArray();

        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch proposals",
          error: error.message,
        });
      }
    });

    app.get("/api/proposals/email", async (req, res) => {
      const email = req.query.email;

      console.log("Searching:", email);

      if (!email) {
        return res.status(400).send({
          message: "Email is required",
        });
      }

      const result = await proposalCollection
        .find({
          $or: [{ freelancerEmailId: email }, { clientEmailId: email }],
        })
        .toArray();

      console.log("Matched:", result);

      res.send(result);
    });

    app.get("/api/proposals/freelancer/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const result = await proposalCollection
          .find({
            freelancerEmailId: email,
          })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to load proposals",
        });
      }
    });

    app.get("/api/proposals/:taskId", async (req, res) => {
      try {
        const { taskId } = req.params;

        const result = await proposalCollection
          .find({ taskId })
          .sort({ createdAt: -1 })
          .toArray();

        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch proposals",
          error: error.message,
        });
      }
    });

    app.get("/api/proposal/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await proposalCollection.findOne({
          _id: new ObjectId(id),
        });

        res.status(200).send(result);
      } catch (error) {
        res.status(500).send({
          message: error.message,
        });
      }
    });
    app.post("/api/proposals", async (req, res) => {
      try {
        const proposal = req.body;

        const newProposal = {
          ...proposal,
          createdAt: new Date(),
        };

        const result = await proposalCollection.insertOne(newProposal);

        res.status(201).json({
          success: true,
          insertedId: result.insertedId,
          message: "Proposal created successfully",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    });

    app.patch("/api/proposals/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await proposalCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status,
            },
          },
        );

        res.send({
          success: true,
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // Payment Relate API

    app.post("/api/payments", async (req, res) => {
      const data = req.body;
      console.log(data);
      const paymentInfo = {
        ...data,
        status: "pending",
        createdAt: new Date(),
      };

      const result = await paymentCollection.insertOne(paymentInfo);

      //update task status

      await taskCollection.updateOne(
        {
          _id: new ObjectId(data.taskId),
        },
        {
          $set: {
            status: "In Progress",
          },
        },
      );

      // update proposal status
      await proposalCollection.updateOne(
        {
          _id: new ObjectId(data.proposalId),
        },
        {
          $set: {
            status: "In Progress",
          },
        },
      );

      // Update payment status
      await paymentCollection.updateOne(
        {
          _id: result.insertedId,
        },
        {
          $set: {
            status: "paid",
          },
        },
      );

      res.json(result);
    });

    app.get("/api/payments", async (req, res) => {
      const cursor = paymentCollection.find();

      const result = await cursor.toArray();

      res.send(result);
    });

    app.get("/api/payments/email", async (req, res) => {
      const email = req.query.email;

      console.log("Searching:", email);

      if (!email) {
        return res.status(400).send({
          message: "Email is required",
        });
      }

      const result = await paymentCollection
        .find({
          $or: [{ freelancerEmailId: email }, { clientEmailId: email }],
        })
        .toArray();

      console.log("Matched:", result);

      res.send(result);
    });

    // await client.db("admin").command({ ping: 1 });
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
