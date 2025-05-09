import "dotenv/config"; // Automatically loads variables from .env
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import { GoogleGenerativeAI } from "@google/generative-ai";
import multer from "multer";
import fs from "fs";


const app = express();
const port = 2000;

app.use(cors({ origin: "*" })); 
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fix __dirname in ES Module mode
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Serve index.html when accessing "/"
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


// Multer setup for image uploads
const upload = multer({ dest: "uploads/" });

// Replace this with your actual API Key
const API_KEY= "AIzaSyBQEw8dxL_11FI-YgCVgUpJ-FqeLbbMd3c";
const genAI = new GoogleGenerativeAI(API_KEY);

// Function to convert files to generative parts
const fileToGenerativePart = (path, mimeType) => ({
  inlineData: {
    data: fs.readFileSync(path).toString("base64"),
    mimeType,
  },
});

// Ping test route
app.get("/ping", (req, res) => {
  res.json({ message: "pong" });
});

// Route to handle image uploads and text generation for teacher
app.post("/generateQuestions", upload.array("images"), async (req, res) => {
  try {
    let { prompt } = req.body;
    const files = req.files || [];

    if (!prompt && files.length === 0) {
      return res
        .status(400)
        .json({ error: "Provide at least a prompt or an image" });
    }
    prompt = `Please generate a question paper based strictly on the syllabus provided in the text or uploaded image.

Structure of the paper:
- **Part A**: 7 questions, each carrying 2 marks. All questions in this part are compulsory. (Total: 14 marks)
- **Part B**: 6 questions. Each question has two sub-questions (a and b), each carrying 7 marks. Attempt any 4 questions from this part. (Total: 56 marks)

Only provide the formatted question paper. Do not include answers. Ensure all questions are relevant and well-aligned with the syllabus.`;

    
    

    const imageParts = files.map((file) =>
      fileToGenerativePart(file.path, file.mimetype)
    );

    let text = "";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      model
        .generateContent([prompt, ...imageParts])
        .then((result) => {
          const response = result.response;
          text = response.text();

          text = text.replace(/\n/g, "\\n").replace(/\t/g, "\\t");

          // Delete uploaded files after processing
          files.forEach((file) => fs.unlinkSync(file.path));

          res.send({ result: text });
        })
        .catch((e) => {
          console.error("Error generating content:", e);
          res.send({ error: "Failed to generate content" });
        });
    } catch (e) {
      console.error("Error generating content:", e);
      res.send({ error: "Failed to generate content" });
    }
  } catch (error) {
    console.error("Error generating content:", error);
    res.send({ error: "Failed to generate content" });
  }
});


// Route to handle image upload and text generation for student
app.post("/generateAnswers", upload.array("images"), async (req, res) => {
  try {
    let { prompt } = req.body;
    const files = req.files || [];

    // Check if at least a prompt or an image is provided
    if (!prompt && files.length === 0) {
      return res
        .status(400)
        .json({ error: "Provide at least a prompt or an image" });
    }

    prompt = `Please analyze the content provided in the text or uploaded image. 
    If the content does not relate to any identifiable subject or question, respond with: 
    "This content does not seem to be related to a specific question or subject matter."
    
    If the content is related to a specific subject or question, follow these steps:
    1. Restate the **Question(s)** clearly at the beginning of your response.
    2. Provide a concise and well-structured **Answer** for each question.
    3. Use \\t for tabs and \\n for newlines to format the answer.
    
    If there are multiple questions, answer them in the order they appear. If the image contains multiple images, analyze each one carefully and answer any questions found in the images.
    
    Avoid including unnecessary tags, details, or unrelated information.
    
    **Question(s):**
    ${prompt}
    
    **Answer:**`;

    // Convert uploaded images into the format expected by the generative model
    const imageParts = files.map((file) =>
      fileToGenerativePart(file.path, file.mimetype)
    );

    let text = "";
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // Send the prompt and image parts to the AI model
      model
        .generateContent([prompt, ...imageParts])
        .then((result) => {
          const response = result.response;
          text = response.text();
          console.log("Generated text:", text);

          // Properly escape newline and tab characters in the response
          text = text.replace(/\n/g, "\\n").replace(/\t/g, "\\t");

          // Delete the uploaded image files
          files.forEach((file) => fs.unlinkSync(file.path));

          // Send the formatted response to the client
          res.send({ result: text });
        })
        .catch((e) => {
          console.error("Error generating content:", e);
          res.send({ error: "Failed to generate content" });
        });
    } catch (e) {
      console.error("Error generating content:", e);
      res.send({ error: "Failed to generate content" });
    }
  } catch (error) {
    console.error("Error generating content:", error);
    res.send({ error: "Failed to generate content" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
