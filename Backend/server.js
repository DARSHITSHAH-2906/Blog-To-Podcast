const express = require('express');
const cors = require('cors');
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require("path");
const ffmpegPath = require('ffmpeg-static');
const ffmpeg = require("fluent-ffmpeg");
const ffprobePath = require('ffprobe-static').path;

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

const { OpenAI } = require('openai');
const { GoogleGenAI } = require('@google/genai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_KEY });

// console.log('OpenAI API Key:', process.env.OPENAI_KEY);

const cleanresponse = (text) => {
    return text
        .replace(/\*\*(.*?)\*\*/g, '$1')           // Remove bold markdown (**bold**)
        .replace(/\*(.*?)\*/g, '$1')               // Remove italic markdown (*italic*)
        .replace(/`+/g, '')                        // Remove backticks `
        .replace(/\\n/g, '\n')                     // Replace escaped newlines
        .replace(/\\+/g, '')                       // Remove stray backslashes
        .replace(/^\s*\n/gm, '')                   // Remove empty lines
        .trim();
}

async function mergeAudioFiles(audioPaths, outputPath) {
    return new Promise((resolve, reject) => {
        const command = ffmpeg();

        // Add each input file
        audioPaths.forEach(filePath => {
            command.input(filePath);
        });

        command
            .on('error', (err) => {
                console.error('Error:', err.message);
                reject(err);
            })
            .on('end', () => {
                console.log('Merge completed');
                resolve(outputPath);
            })
            .mergeToFile(outputPath, path.dirname(outputPath));
    });
}

const downloadandmerge = async (urls) => {
    const folder = path.resolve("./temp_audio");
    if (!fs.existsSync(folder)) fs.mkdirSync(folder);

    const mp3files = [];

    try {
        for (let i = 0; i < urls.length; ++i) {
            const wavpath = path.join(folder, `part${i}.wav`);
            const mp3path = path.join(folder, `part${i}.mp3`);

            console.log(`🔽 Downloading: ${urls[i]}`);
            const response = await axios({
                method: "get",
                url: urls[i],
                responseType: 'stream',
            });

            const writer = fs.createWriteStream(wavpath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on("finish", resolve);
                writer.on("error", reject);
            });

            console.log(` Converting to MP3: ${wavpath} → ${mp3path}`);
            await new Promise((resolve, reject) => {
                ffmpeg(wavpath)
                    .audioCodec('libmp3lame') // use mp3 codec
                    .format('mp3')
                    .on("end", () => {
                        console.log(` Converted: ${mp3path}`);
                        mp3files.push(mp3path);
                        resolve();
                    })
                    .on("error", (err) => {
                        console.error(` Error converting ${wavpath}:`, err.message);
                        reject(err);
                    })
                    .save(mp3path);
            });
        }

        if (mp3files.length === 0) {
            throw new Error("No valid MP3 files to merge.");
        }

        const finalPath = path.join(folder, "merged_output.mp3");

        console.log(" Merging MP3 files...");
        await mergeAudioFiles(mp3files, finalPath);
        console.log(" All done!");
        return finalPath;

    } catch (err) {
        console.error(" Error in downloadandmerge:", err.message);
        return "";
    }
};


const startserver = async () => {
    const app = express();
    app.use(cors());
    app.use(express.json());
    app.use('/temp_audio',express.static(path.join(__dirname , "temp_audio")))

    app.post('/chat/openai', async (req, res) => {
        const { prompt, model } = req.body;
        try {
            // const response = await openai.chat.completions.create({
            //     model : model || 'gpt-3.5-turbo',
            //     messages: [{role: 'user', content: prompt}],
            //     max_tokens: 100,
            //     temperature: 0.7
            // })

            const response = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: prompt
            })

            const processedtext = cleanresponse(response.candidates[0].content.parts[0].text);

            res.status(200).json({
                text: processedtext
            });

        } catch (error) {
            console.error('Error calling OpenAI API:', error);
            res.status(500).json({ error: 'An error occurred while processing your request.' });
        }
    });

    app.post("/genrate", async (req, res) => {
        const { conversation, guest_voice, host_voice } = req.body;
        console.log(guest_voice, host_voice);
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
        }

        let audiofiles = [];

        try {
            const lines = conversation.split('\n');
            console.log(lines)
            for (const line of lines) {
                if (line.startsWith("Guest:")) {
                    data.text = line.replace("Guest:", "").trim();
                    data.voiceId = guest_voice;
                } else if (line.startsWith("Host:")) {
                    data.text = line.replace("Host:", "").trim();
                    data.voiceId = host_voice;
                }else{
                    continue;
                }

                config.data = data;

                console.log(config)

                const response = await axios.post("https://api.murf.ai/v1/speech/generate", data, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'api-key': process.env.MURF_API
                    }
                });

                const audiofile = response.data.audioFile;
                if (audiofile) {
                    console.log("Pushing audio file:", audiofile);
                    audiofiles.push(audiofile);
                } else {
                    console.warn("⚠️ No audioFile in response for:", text);
                }

            }
            console.log("Audio files created...", audiofiles)
            const mergedpath = await downloadandmerge(audiofiles);

            res.json({ audioUrl: 'http://localhost:3000/temp_audio/merged_output.mp3' });

        } catch (error) {
            console.log(error);
        }
    });

    app.listen(3000, () => console.log('Server is running on port 3000'));
};

startserver();