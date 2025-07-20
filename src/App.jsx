import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';
import './App.css';
import Loader from './component/Loader';
import Loader1 from './component/Loader1';

let prompt = `You are a professional AI content transformation assistant.

Your task is to take the input blog content and convert it into a clear, natural, and engaging {tone} conversation between two characters. The conversation should sound authentic, keep the listener interested, and simplify complex ideas where needed.

Use the following rules:

- Keep the tone: {tone} (e.g., Podcast, Debate, Lecture, Narration, Therapeutic Mode).
- Make it conversational: turn paragraphs into dialogues or monologues depending on the tone.
- If the tone is **Podcast** or **Debate**, use character names **Host** and **Guest** only. Do not use any other names like Vikram, Rahi, etc.
- Use plain, friendly language while preserving key facts and details.
- Rephrase jargon or technical phrases to be more understandable.
- Add light expressions or natural pauses to make the delivery feel real.
- **Generate the entire output directly in this language: {language}. Do not include any English unless the language is English. Do not translate—generate natively in {language}.**

Content to transform:

--- START OF BLOG ---
{blogText}
--- END OF BLOG ---

Ensure the final result is fluid, sounds naturally spoken aloud, and strictly uses {language} throughout.
`
function App() {
  const [text, setText] = useState('');
  const [language, setLanguage] = useState('en');
  const [loading, setLoading] = useState(false);
  const [conversionType, setConversionType] = useState('Podcast');
  // const [aiModel, setAiModel] = useState('gpt-3.5-turbo');
  const [processedtext, setProcessedText] = useState('The processed conversion output will appear here...');
  const [guestVoice, setGuestVoice] = useState('hi-IN-rahul');
  const [hostvoice, setHostVoice] = useState('hi-IN-kabir');
  const [audio_url, setaudio_url] = useState("");
  const [generatingAudio, Setgeneratingaudio] = useState(false);


  // Extract blog content from current tab
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(
        tabs[0].id,
        { action: 'getBlogContent' },
        (response) => {
          if (response?.text) {
            setText(response.text);
          } else {
            setText('Failed to extract content. Please paste the blog content manually.');
          }
        }
      );
    });
  }, []);

  const handleprocesstext = () => {
    if (text === 'Failed to extract content. Please try a different page.') {
      setProcessedText('Please extract the blog content first.');
      return;
    }

    prompt = prompt.replaceAll('{tone}', conversionType);
    prompt = prompt.replaceAll('{language}', language);
    prompt = prompt.replaceAll('{blogText}', text);
    setText(text.replaceAll("/\n+/g"), "\n")

    setLoading(true);
    axios.post("http://localhost:3000/chat/openai",
      {
        prompt: prompt,
        // model: aiModel,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    )
      .then((response) => {
        setLoading(false);
        setProcessedText(response.data.text);
      }).catch(error => {
        setLoading(false);
        setProcessedText('Failed to process the text. Try again after some time');
      })
  }

  const generateAndConvert = () => {
    if (processedtext === 'The processed conversion output will appear here...') {
      setProcessedText('Please process the text first.');
      return;
    }

    const conversation = processedtext;

    const data = {
      conversation: conversation,
      guest_voice: guestVoice,
      host_voice: hostvoice
    };

    Setgeneratingaudio(true);

    axios.post("http://localhost:3000/genrate", data, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then((response) => {
        Setgeneratingaudio(false);
        setaudio_url(response.data.audioUrl);
      })
      .catch((error) => {
        Setgeneratingaudio(false);
        console.error('Error generating audio:', error);
        setProcessedText('Failed to generate audio. Please try again.');
      });
  }

  return (
    <div className="w-[380px] mx-auto p-4 bg-[#111827] text-white font-sans shadow-xl rounded-xl space-y-4">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-indigo-400">🎙️ Blogcast</h1>
        <p className="text-sm text-gray-400">Convert your blog into a podcast instantly.</p>
      </div>

      {/* Blog Text */}
      <label className="block text-sm text-gray-400">📄 Extracted Blog Text</label>
      <textarea
        className="w-full h-28 p-2 rounded-lg bg-[#1f2937] text-gray-100 border border-gray-600 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste your blog content here..."
      />

      {/* Selections */}
      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm text-gray-400">🔁 Conversion Type</label>
          <select className="w-full p-2 rounded-lg bg-[#1f2937] border border-gray-600 text-white" value={conversionType} onChange={(e) => setConversionType(e.target.value)}>
            <option>Podcast</option>
            <option>Debate</option>
            <option>Short Summary</option>
            <option>Summary</option>
            <option>Narration</option>
            <option>Lecture</option>
            <option>Therapeutic Mode</option>
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400">🌐 Output Language</label>
          <select className="w-full p-2 rounded-lg bg-[#1f2937] border border-gray-600 text-white" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option>English</option>
            <option>Hindi</option>
            <option>German</option>
            <option>Spanish</option>
          </select>
        </div>
      </div>

      {/* Process Text Button */}
      <button
        className="w-full mt-2 bg-indigo-500 hover:bg-indigo-600 text-white text-[16px] font-semibold py-2 rounded-lg transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={generatingAudio || loading}
        onClick={handleprocesstext}
      >
        {loading ? (
          <div className="flex justify-center items-center h-4">
            <Loader className="h-3 w-3 animate-spin text-white" />
          </div>
        ) : (
          "✨ Process Text"
        )}
      </button>

      {/* Processed Output */}
      <label className="block text-sm text-gray-400 mt-4">📝 Processed Output</label>
      <textarea
        className="w-full h-28 p-2 rounded-lg bg-[#1f2937] text-gray-100 border border-gray-600 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        value={processedtext}
        onChange={(e) => setProcessedText(e.target.value)}
        placeholder="Processed output will appear here..."
      />

      {/* Voice Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-gray-400">🔊 Guest Voice</label>
          <select className="w-full p-2 rounded-lg bg-[#1f2937] border border-gray-600 text-white" value={guestVoice} onChange={(e) => setGuestVoice(e.target.value)}>
            <option value="hi-IN-kabir">Kabir</option>
            <option value="hi-IN-rahul">Rahul</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-400">🎤 Host Voice</label>
          <select className="w-full p-2 rounded-lg bg-[#1f2937] border border-gray-600 text-white" value={hostvoice} onChange={(e) => setHostVoice(e.target.value)}>
            <option value="hi-IN-kabir">Kabir</option>
            <option value="hi-IN-rahul">Rahul</option>
          </select>
        </div>
      </div>

      {/* Generate Audio */}
      {generatingAudio ? (
        <div className="mt-3 flex justify-center">
          <Loader1 />
        </div>
      ) : (
        <button
          className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold py-2 rounded-lg mt-3 transition duration-300"
          onClick={generateAndConvert}
        >
          🚀 Generate & Convert
        </button>
      )}

      {/* Audio Player */}
      {audio_url && (
        <audio src={audio_url} option></audio>
      )}
    </div>

  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

export default App;
