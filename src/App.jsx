import React from 'react';
import VideoProcessor from './components/VideoProcessor';

function App() {
    return (
        <div className="min-h-screen p-8 flex flex-col items-center justify-center relative overflow-hidden">
            {/* Subtle decorative elements */}
            <div className="absolute top-20 left-10 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-20 right-10 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            <header className="mb-16 text-center relative z-10 animate-slide-up">
                <h1 className="text-7xl font-semibold text-slate-900 mb-4 tracking-tight animate-fade-in">
                    Video Frame Extractor
                </h1>
                <p className="text-slate-600 text-xl font-light animate-fade-in" style={{ animationDelay: '0.2s' }}>動画からフレームを抽出してPNGで保存</p>
            </header>

            <main className="w-full max-w-5xl relative z-10 animate-scale-in" style={{ animationDelay: '0.3s' }}>
                <VideoProcessor />
            </main>
        </div>
    );
}

export default App;
