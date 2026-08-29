```javascript
import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDirectory = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}


/* =========================
   OPENAI
========================= */

if (!process.env.OPENAI_API_KEY) {
    console.warn(
        "WARNING: OPENAI_API_KEY is not configured."
    );
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});


/* =========================
   MULTER
========================= */

const upload = multer({

    dest: uploadDirectory,

    limits: {
        fileSize: 25 * 1024 * 1024
    }

});


/* =========================
   EXPRESS
========================= */

app.use(express.json({
    limit: "2mb"
}));

app.use(express.static(
    path.join(__dirname, "public")
));


/* =========================
   HEALTH CHECK
========================= */

app.get("/api/health", (req, res) => {

    res.json({

        success: true,

        app: "LingoWave",

        status: "online"

    });

});


/* =========================
   TEXT TRANSLATION
========================= */

app.post("/api/translate", async (req, res) => {

    try {

        const {
            text,
            sourceLanguage = "Auto Detect",
            targetLanguage = "English"
        } = req.body;


        if (!text || !text.trim()) {

            return res.status(400).json({

                success: false,

                error: "Please enter text to translate."

            });

        }


        const response =
            await openai.responses.create({

                model: "gpt-5.6-luna",

                instructions:
                    `You are LingoWave, an expert multilingual
translation engine.

Translate the user's text accurately.

Source language:
${sourceLanguage}

Target language:
${targetLanguage}

Rules:
- Preserve the original meaning.
- Preserve names.
- Preserve slang where appropriate.
- Preserve cultural meaning.
- Do not add unnecessary explanations.
- Return only the translation.`,

                input: text

            });


        res.json({

            success: true,

            translation:
                response.output_text

        });


    } catch (error) {

        console.error(
            "TEXT TRANSLATION ERROR:",
            error
        );


        res.status(500).json({

            success: false,

            error:
                "Translation service failed."

        });

    }

});


/* =========================
   AUDIO TRANSLATION
========================= */

app.post(
    "/api/translate-audio",
    upload.single("audio"),
    async (req, res) => {

        let temporaryFile = null;

        try {

            if (!req.file) {

                return res.status(400).json({

                    success: false,

                    error:
                        "Please upload an audio file."

                });

            }


            temporaryFile =
                req.file.path;


            const sourceLanguage =
                req.body.sourceLanguage ||
                "Auto Detect";


            /*
             * STEP 1
             * TRANSCRIBE AUDIO
             */

            const transcription =
                await openai.audio.transcriptions.create({

                    file:
                        fs.createReadStream(
                            temporaryFile
                        ),

                    model:
                        "gpt-4o-transcribe",

                    response_format:
                        "json"

                });


            const originalText =
                transcription.text || "";


            if (!originalText.trim()) {

                return res.status(400).json({

                    success: false,

                    error:
                        "No speech or lyrics were detected."

                });

            }


            /*
             * STEP 2
             * TRANSLATE
             */

            const translation =
                await openai.responses.create({

                    model:
                        "gpt-5.6-luna",

                    instructions:
                        `You are LingoWave's multilingual
translation engine.

Translate the following transcription
into English.

Source language:
${sourceLanguage}

Requirements:
- Preserve meaning.
- Preserve names.
- Preserve slang.
- Preserve idioms.
- Preserve cultural references.
- If this appears to be a song, preserve
  line breaks and lyrical structure.
- Do not add explanations.
- Return only the English translation.`,

                    input:
                        originalText

                });


            res.json({

                success: true,

                original:
                    originalText,

                translation:
                    translation.output_text

            });


        } catch (error) {

            console.error(
                "AUDIO ERROR:",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    error?.message ||
                    "Audio translation failed."

            });


        } finally {

            /*
             * DELETE TEMPORARY AUDIO
             */

            if (temporaryFile) {

                try {

                    fs.unlinkSync(
                        temporaryFile
                    );

                } catch {

                    console.log(
                        "Temporary file cleanup skipped."
                    );

                }

            }

        }

    }
);


/* =========================
   SPA FALLBACK
========================= */

app.get("*", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


/* =========================
   START
========================= */

app.listen(PORT, () => {

    console.log("");
    console.log("================================");
    console.log("       LINGOWAVE ONLINE");
    console.log("================================");
    console.log(
        `Server: http://localhost:${PORT}`
    );
    console.log("================================");
    console.log("");

});
```
