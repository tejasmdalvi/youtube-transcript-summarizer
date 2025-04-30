import time
from flask import Flask, request, jsonify
from youtube_transcript_api import YouTubeTranscriptApi
import google.generativeai as genai
from flask_cors import CORS


app = Flask(__name__)
CORS(app)  # Enable CORS for frontend requests

# Set your Google Bard (Gemini) API key here
genai.configure(api_key="ENTER YOUR GEMINI API KEY")

# Fetch transcript from YouTube
@app.route('/fetch_transcript', methods=['POST'])
def fetch_transcript():
    try:
        data = request.get_json()
        video_id = data.get("video_input")  #  matching

        if not video_id:
            return jsonify({"error": "Missing 'video_input' in request"}), 400

        
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        preferred_languages = ['hi', 'mr', 'en', 'ta', 'te', 'gu', 'ml', 'raj','bn','kn','ur','pa']


        try:
            
            transcript = transcript_list.find_transcript(preferred_languages)
        except:
            try:
                
                transcript = transcript_list.find_transcript(transcript_list._languages)
            except:
                return jsonify({"error": "No transcript available for this video."}), 404

        transcript_data = transcript.fetch()
        transcript_text = " ".join([entry['text'] for entry in transcript_data])

        return jsonify({"transcript": transcript_text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route('/summarize', methods=['POST'])
def summarize_transcript():
    try:
        data = request.get_json()
        transcript = data.get("transcript")

        if not transcript:
            return jsonify({"error": "Missing transcript in request"}), 400

        transcript_words = transcript.split()  # Split transcript into words
        transcript_length_words = len(transcript_words)  # Count total words

        model = genai.GenerativeModel("gemini-1.5-flash")  

        if transcript_length_words < 100:
            prompt = f"Summarize this transcript in 1 sentence: {transcript}"


        elif 100 <= transcript_length_words < 500:
            prompt = f"Summarize this transcript in 2-3 sentences: {transcript}"


        elif 500 <= transcript_length_words < 1500:
            prompt = f"Summarize this transcript in 4-6 sentences: {transcript}"

        elif 1500 <= transcript_length_words < 4000:
            prompt = f"Summarize this transcript in a detailed paragraph (8-10 sentences): {transcript}"

        elif 4000 <= transcript_length_words < 7000:
            prompt = f"Summarize this transcript in 2-3 well-structured paragraphs: {transcript}"

        elif 7000 <= transcript_length_words < 30000:
            prompt = f"Summarize this transcript in 4-5 well-structured paragraphs: {transcript}"

        elif 30000 <= transcript_length_words < 90000:
            prompt = f"Summarize this transcript in 6-8 well-structured paragraphs: {transcript}"


        else:
            chunk_size = 500  # Split transcript into 500-word chunks
            transcript_chunks = [" ".join(transcript_words[i:i + chunk_size]) for i in range(0, len(transcript_words), chunk_size)]
            summaries = []

            for chunk in transcript_chunks:
                response = model.generate_content(f"Summarize this transcript segment in 3-5 concise sentences: {chunk}")
                summaries.append(response.text)
                time.sleep(2)  # usage limits

            final_summary = " ".join(summaries)
            return jsonify({"summary": final_summary})

        # **Process single request for shorter transcripts**
        response = model.generate_content(prompt)
        return jsonify({"summary": response.text})

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
from deep_translator import GoogleTranslator, exceptions
import time

def chunk_text(text, max_length=500):
    """Splits text into smaller chunks of max_length words"""
    words = text.split()
    return [" ".join(words[i:i + max_length]) for i in range(0, len(words), max_length)]

@app.route('/translate', methods=['POST'])
def translate_summary():
    try:
        data = request.get_json()
        text = data.get("text")
        target_lang = data.get("target_lang")

        if not text:
            return jsonify({"error": "No text provided for translation."}), 400
        if target_lang not in ["hi", "mr", "en","gu"]:
            return jsonify({"error": "Unsupported language."}), 400

        print(f"Translating to {target_lang}: {text[:100]}...")  # Debugging log

        transcript_words = text.split()
        transcript_length_words = len(transcript_words)

        def safe_translate(text_chunk):
            """Attempts to translate a chunk, retries if a connection error occurs"""
            retries = 3
            for i in range(retries):
                try:
                    return GoogleTranslator(source="auto", target=target_lang).translate(text_chunk)
                except exceptions.RequestException:
                    print(f"Translation request failed. Retrying {i + 1}/{retries}...")
                    time.sleep(2)  # Wait before retrying
            return "Translation failed due to network issues."

        #  **Translation on Length
        if transcript_length_words < 100:
            translated_text = safe_translate(text)

        elif 100 <= transcript_length_words < 500:
            translated_text = safe_translate(text)

        elif 500 <= transcript_length_words < 1500:
            chunks = chunk_text(text, max_length=400)
            translations = [safe_translate(chunk) for chunk in chunks]
            translated_text = " ".join(translations)

        elif 1500 <= transcript_length_words < 4000:
            chunks = chunk_text(text, max_length=500)
            translations = [safe_translate(chunk) for chunk in chunks]
            translated_text = " ".join(translations)

        elif 4000 <= transcript_length_words < 7000:
            chunks = chunk_text(text, max_length=600)
            translations = [safe_translate(chunk) for chunk in chunks]
            translated_text = " ".join(translations)

        elif 7000 <= transcript_length_words < 30000:
            chunks = chunk_text(text, max_length=800)
            translations = [safe_translate(chunk) for chunk in chunks]
            translated_text = " ".join(translations)

        elif 30000 <= transcript_length_words < 90000:
            chunks = chunk_text(text, max_length=1000)
            translations = [safe_translate(chunk) for chunk in chunks]
            translated_text = " ".join(translations)

        else:
            chunk_size = 1200  # Larger chunk size for very long texts
            transcript_chunks = chunk_text(text, max_length=chunk_size)
            translations = [safe_translate(chunk) for chunk in transcript_chunks]
            translated_text = " ".join(translations)

        return jsonify({"translation": translated_text})

    except Exception as e:
        print(f"Translation Error: {str(e)}")  # Debugging
        return jsonify({"error": f"Translation failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
