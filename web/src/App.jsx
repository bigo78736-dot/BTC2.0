import React, { useEffect, useRef, useState } from 'react';

const API = '/api';
const pollDelay = 4000;

export default function App() {
  const [prompt, setPrompt] = useState('A cinematic sunrise over a quiet mountain lake, gentle camera push-in, soft mist, natural colors.');
  const [ratio, setRatio] = useState('16:9');
  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pollTimer = useRef(null);

  useEffect(() => () => clearTimeout(pollTimer.current), []);

  async function pollJob(id) {
    try {
      const response = await fetch(`${API}/videos/${encodeURIComponent(id)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not check generation status.');
      setJob(data);
      if (data.status === 'queued' || data.status === 'processing') {
        pollTimer.current = setTimeout(() => pollJob(id), pollDelay);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function createVideo(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    setJob(null);
    try {
      const response = await fetch(`${API}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio: ratio })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Video generation could not start.');
      setJob(data);
      pollJob(data.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const videoUrl = job?.status === 'completed' ? `${API}/videos/${encodeURIComponent(job.id)}/file` : '';

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-icon">▶</span><span>Bigooay <b>Studio</b></span></a>
      <span className="secure-label">AI VIDEO CREATOR</span>
    </header>
    <main>
      <section className="intro">
        <p className="eyebrow">YOUR STORY, IN MOTION</p>
        <h1>Make a video<br/><span>from your words.</span></h1>
        <p>Describe a scene and generate an original AI video. Generations can take a few minutes.</p>
      </section>

      <section className="workspace">
        <form className="prompt-panel" onSubmit={createVideo}>
          <label htmlFor="prompt">Describe your video</label>
          <textarea id="prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={2000} required minLength={8} placeholder="Describe the scene, subject, action, camera movement, and visual style…" />
          <div className="prompt-footer"><span>{prompt.length}/2000</span><span>Be specific about motion and camera style</span></div>
          <div className="controls">
            <label htmlFor="ratio">Aspect ratio</label>
            <select id="ratio" value={ratio} onChange={event => setRatio(event.target.value)}>
              <option value="16:9">Landscape · 16:9</option>
              <option value="9:16">Portrait · 9:16</option>
              <option value="1:1">Square · 1:1</option>
            </select>
            <span className="duration">8 sec · 1 video</span>
          </div>
          <button className="generate-btn" type="submit" disabled={submitting || job?.status === 'processing' || job?.status === 'queued'}>
            {submitting ? 'Starting…' : job?.status === 'processing' || job?.status === 'queued' ? 'Generating…' : '✦ Generate video'}
          </button>
          <p className="disclosure">AI-generated content. Only use prompts and likenesses you have rights and permission to use.</p>
        </form>

        <section className="result-panel" aria-live="polite">
          <div className="result-heading"><h2>Your video</h2>{job?.status && <span className={`status ${job.status}`}>{job.status}</span>}</div>
          {error && <div className="error" role="alert">{error}</div>}
          {job?.status === 'completed' ? <video className="output-video" src={videoUrl} controls playsInline /> :
            job?.status === 'failed' ? <div className="empty-state"><span>⚠</span><p>{job.error || 'Generation failed. Please try again.'}</p></div> :
            job?.status === 'processing' || job?.status === 'queued' ? <div className="empty-state"><span className="spinner"/><h3>Creating your video</h3><p>This can take several minutes. You can keep this page open while it renders.</p></div> :
            <div className="empty-state"><span className="sparkle">✦</span><h3>Your next idea starts here</h3><p>Generated videos will appear here when ready.</p></div>}
          {job?.status === 'completed' && <a className="download" href={videoUrl} download={`bigooay-${job.id}.mp4`}>Download video</a>}
        </section>
      </section>
      <section className="tips"><h2>Tips for a stronger prompt</h2><p>Describe the subject and action, setting, lighting, camera movement, and mood. Avoid asking to recreate a real person without their consent.</p></section>
    </main>
    <footer>Bigooay Studio · AI-generated video · Use responsibly</footer>
  </div>;
}
