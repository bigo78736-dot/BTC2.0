import React, { useState } from 'react';

const rooms = [
  { title: 'Bigo Live Creator', host: 'Maya', viewers: '12.4K', image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?auto=format&fit=crop&w=700&q=80' },
  { title: 'Music Night', host: 'Aria', viewers: '8.1K', image: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=700&q=80' },
  { title: 'Gaming Live', host: 'Shadow', viewers: '5.8K', image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=700&q=80' },
  { title: 'Travel & Life', host: 'Nora', viewers: '3.2K', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80' }
];

export default function App() {
  const [menu, setMenu] = useState(false);
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(['Welcome to Bigooay Live!']);

  function sendMessage() {
    if (!message.trim()) return;
    setMessages(prev => [...prev, message.trim()]);
    setMessage('');
  }

  return <>
    <header className="topbar">
      <button className="menu" onClick={() => setMenu(v => !v)} aria-label="Menu">☰</button>
      <a className="brand" href="#"><b>BIGOOAY</b><span>LIVE</span></a>
      <button className="search" aria-label="Search">⌕</button>
    </header>

    <nav className={menu ? 'nav open' : 'nav'}>
      <a className="active" href="#">Popular</a><a href="#">New</a><a href="#">Music</a><a href="#">Gaming</a>
    </nav>

    <main>
      <section className="hero">
        <div><span className="live-tag">LIVE</span><h1>Discover live creators</h1><p>Watch, chat, follow, and go live.</p></div>
        <button className="go-live">＋ Go Live</button>
      </section>

      <section>
        <div className="heading"><h2>Popular Live</h2><button>See All</button></div>
        <div className="grid">
          {rooms.map((item, index) => <article className="room" key={item.title} onClick={() => setRoom(item)}>
            <div className="cover"><img src={item.image} alt=""/><span className="live">LIVE</span><span className="viewers">◉ {item.viewers}</span></div>
            <h3>{item.title}</h3><p>@{item.host}</p>
          </article>)}
        </div>
      </section>

      <section>
        <div className="heading"><h2>Recommended</h2><button>See All</button></div>
        <div className="grid compact">
          {rooms.slice().reverse().map(item => <article className="room" key={item.title} onClick={() => setRoom(item)}>
            <div className="cover"><img src={item.image} alt=""/><span className="live">LIVE</span></div>
            <h3>{item.title}</h3><p>@{item.host}</p>
          </article>)}
        </div>
      </section>
    </main>

    {room && <div className="modal" onClick={e => e.target === e.currentTarget && setRoom(null)}>
      <div className="stream">
        <button className="close" onClick={() => setRoom(null)}>×</button>
        <div className="video"><img src={room.image} alt=""/><span className="live">LIVE</span></div>
        <div className="chat">
          <div className="chat-title"><strong>{room.title}</strong><span>{room.viewers} watching</span></div>
          <div className="messages">{messages.map((text, i) => <p key={i}>{text}</p>)}</div>
          <div className="composer"><input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Send a message"/><button onClick={sendMessage}>➤</button></div>
        </div>
      </div>
    </div>}
  </>;
}
