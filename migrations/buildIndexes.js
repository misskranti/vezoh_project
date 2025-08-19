// // migrations/buildIndexes.js
// const mongoose = require("mongoose");
// const fs = require("fs");
// const path = require("path");
// require("dotenv").config();

// const LOG_FILE = path.join(__dirname, "../logs/indexBuild.log");

// // Utility: write logs to file + console
// function logMessage(message) {
//   console.log(message);
//   fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${message}\n`);
// }

// const connectDB = async () => {
//   try {
//     await mongoose.connect(process.env.MONGO_URI, {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     });
//     logMessage("MongoDB connected for index build");
//   } catch (err) {
//     logMessage("MongoDB connection failed: " + err.message);
//     process.exit(1);
//   }
// };

// const buildIndexes = async () => {
//   try {
//     // Create logs folder if not exists
//     const logsDir = path.join(__dirname, "../logs");
//     if (!fs.existsSync(logsDir)) {
//       fs.mkdirSync(logsDir);
//     }

//     // Load all models dynamically
//     const modelsDir = path.join(__dirname, "../models");
//     fs.readdirSync(modelsDir).forEach((file) => {
//       if (file.endsWith(".js")) {
//         require(path.join(modelsDir, file));
//       }
//     });

//     const modelNames = mongoose.modelNames();
//     for (const name of modelNames) {
//       const model = mongoose.model(name);

//       logMessage(`\n Checking indexes for: ${name}`);

//       // Show existing indexes
//       const existing = await model.collection.indexes();
//       logMessage("    Existing indexes: " + JSON.stringify(existing.map(i => i.name)));

//       // Ensure indexes
//       await model.createIndexes();
//       logMessage(`    Missing indexes created for ${name}`);

//       // Show updated indexes
//       const updated = await model.collection.indexes();
//       logMessage("    Final indexes: " + JSON.stringify(updated.map(i => i.name)));
//     }

//     logMessage("\n All indexes processed successfully!");
//     process.exit(0);
//   } catch (err) {
//     logMessage(" Error building indexes: " + err.message);
//     process.exit(1);
//   }
// };

// connectDB().then(buildIndexes);
