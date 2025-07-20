const express = require('express');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require("path");
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require("fluent-ffmpeg");
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

const cleanresponse = (text) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`+/g, '')
        .replace(/\\n/g, '\n')
        .replace(/\\+/g, '')
        .replace(/^\s*\n/gm, '')
        .trim();
};

async function mergeAudioFiles(audioPaths, outputPath) {
    return new Promise((resolve, reject) => {
        const command = ffmpeg();

        audioPaths.forEach(filePath => {
            command.input(filePath);
        });

        command
            .on('error', (err) => {
                console.error('Error merging audio:', err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('✅ Merge completed');
                resolve(outputPath);
            })
            .mergeToFile(outputPath, path.dirname(outputPath));
    });
}


const downloadandmerge = async (urls) => {
    const folder = path.resolve("./temp_audio");
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    try {
        const downloadPromises = urls.map((url, i) => {
            const mp3path = path.join(folder, `part${i}.mp3`);
            return axios({
                method: "get",
                url: url,
                responseType: 'stream',
            }).then(response => {
                return new Promise((resolve, reject) => {
                    const writer = fs.createWriteStream(mp3path);
                    response.data.pipe(writer);
                    writer.on("finish", () => resolve(mp3path));
                    writer.on("error", reject);
                });
            });
        });

        const mp3Files = await Promise.all(downloadPromises);
        console.log("✅ All MP3 files downloaded");

        const finalPath = path.join(folder, "merged_output.mp3");

        console.log("🔗 Merging MP3 files...");
        await mergeAudioFiles(mp3Files, finalPath);
        console.log("🎉 All done!");

        return finalPath;

    } catch (err) {
        console.error("❌ Error in downloadandmerge:", err.message);
        return "";
    }
};

const startserver = async () => {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/temp_audio', express.static(path.join(__dirname, "temp_audio")));

    app.post('/chat', async (req, res) => {
        const { prompt } = req.body;
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt
            });

            const processedtext = cleanresponse(response.candidates[0].content.parts[0].text);

            res.status(200).json({
                text: processedtext
            });

        } catch (error) {
            console.error('Error calling Google Gemini API:', error);
            res.status(500).json({ error: 'An error occurred while processing your request.' });
        }
    });

    app.post("/generate", async (req, res) => {
        const { conversation, guest_voice, host_voice } = req.body;
        console.log("Received conversation:", conversation);
        const config = {
            method: 'post',
            url: 'https://api.murf.ai/v1/speech/generate',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'api-key': process.env.MURF_API
            },
        };

        let data = {
            text: "",
            voiceId: ""
        };

        let audiofiles = [];

        try {
            const lines = conversation.split('\n');
            for (const line of lines) {
                if (line.startsWith("Guest:")) {
                    data.text = line.replace("Guest:", "").trim();
                    data.voiceId = guest_voice;
                } else if (line.startsWith("Host:")) {
                    data.text = line.replace("Host:", "").trim();
                    data.voiceId = host_voice;
                } else {
                    continue;
                }

                const response = await axios.post("https://api.murf.ai/v1/speech/generate", data, {
                    headers: config.headers
                });

                const audiofile = response.data.audioFile;
                if (audiofile) {
                    console.log("✅ Pushing audio file:", audiofile);
                    audiofiles.push(audiofile);
                } else {
                    console.warn("⚠️ No audioFile in response for:", data.text);
                }
            }

            console.log("Audio files collected:", audiofiles);
            const mergedpath = await downloadandmerge(audiofiles);
            if (!mergedpath) {
                return res.status(500).json({ error: "Failed to merge audio files." });
            }

            const audioUrl = "http://localhost:3000/temp_audio/merged_output.mp3";
            console.log("🎧 Audio URL:", audioUrl);
            res.status(200).json({ audioUrl });

        } catch (error) {
            console.error(error);
            res.status(500).json({ error: "Failed to generate podcast." });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`🚀 Server is running on port ${PORT}`));
};

startserver();
