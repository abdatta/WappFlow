import React, { useState } from 'react';
import { sendMessage } from '../lib/api';

export default function Send() {
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [disablePrefix, setDisablePrefix] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await sendMessage({ phone, text, disablePrefix });
      setStatus('Message sent successfully');
      setPhone('');
      setText('');
    } catch (err: any) {
      setStatus(err.response?.data?.error || 'Failed to send');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Send Message</h1>
      <form onSubmit={handleSubmit} className="bg-gray-800 p-4 rounded-lg space-y-4 max-w-md">
        <div>
          <label className="block mb-1">Phone (E.164)</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-700 text-white"
          />
        </div>
        <div>
          <label className="block mb-1">Message</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full px-3 py-2 rounded bg-gray-700 text-white"
          />
        </div>
        <div className="flex items-center space-x-2">
          <input type="checkbox" id="disablePrefixSend" checked={disablePrefix} onChange={(e) => setDisablePrefix(e.target.checked)} />
          <label htmlFor="disablePrefixSend">Disable prefix</label>
        </div>
        <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
          Send
        </button>
        {status && <p className="text-yellow-400 text-sm">{status}</p>}
      </form>
    </div>
  );
}