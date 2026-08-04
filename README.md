# 🎓 AI Teacher Hub

**Your Smart Teaching Companion — powered by AI.**

AI Teacher Hub is a full-stack platform built to take the repetitive, time-consuming parts of teaching off a teacher's plate. From lesson planning to quiz generation to instant doubt resolution, it brings AI directly into a teacher's daily workflow — so educators can spend less time on prep and more time actually teaching. 🚀

---

## ✨ Features

- 📝 **Automated Lesson Planning** — Generate structured, curriculum-aligned lesson plans in minutes.
- ❓ **Instant Quiz & Question Paper Generation** — Create quizzes and assessments tailored to topic, difficulty, and grade level.
- 🤖 **AI-Powered Doubt Resolution** — Give students instant, accurate answers, reducing classroom back-and-forth.
- 🎬 **Smooth, Motion-Driven UI** — Clean, animated interface built for an engaging, modern user experience.
- ⚡ **Fast & Intuitive** — Minimal friction for teachers regardless of tech comfort.

---

## 🛠️ Tech Stack

| Layer      | Technology                  |
|------------|------------------------------|
| Frontend   | React, Motion/Animation UI   |
| Backend    | Node.js, Express             |
| AI Layer   | AI API integration           |
| Version Control | Git & GitHub            |

---

## 📂 Project Structure

```
AI_Teacher_Resource_Hub/
├── client/          # React frontend (UI, components, animations)
├── server/          # Node.js + Express backend, API routes
├── .env.example     # Environment variable template
├── package.json
└── README.md
```

> Update this section to match your actual folder layout if it differs.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+ recommended)
- npm or yarn
- An API key for the AI service used (see `.env.example`)

### Installation

```bash
# Clone the repository
git clone https://github.com/Saksham-dev-del/AI-Teacher-Hub.git
cd AI-Teacher-Hub

# Install frontend dependencies
cd client
npm install

# Install backend dependencies
cd ../server
npm install
```

### Environment Variables

Create a `.env` file in the `server` directory with the following:

```env
PORT=5000
AI_API_KEY=your_api_key_here
```

### Running Locally

```bash
# Start backend
cd server
npm start

# Start frontend (in a new terminal)
cd client
npm start
```

The app should now be running at `http://localhost:3000` (frontend) with the API on `http://localhost:5000`.

---

## 🗺️ Roadmap

- [ ] Bug fixes and stability improvements (in progress)
- [ ] Data-driven insights dashboard for teachers
- [ ] Multi-language support
- [ ] Mobile-responsive enhancements

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source. Add your preferred license (MIT recommended) here.

---

## 🌟 Show Your Support

If you believe AI can make teaching better — not harder — give this repo a ⭐!
