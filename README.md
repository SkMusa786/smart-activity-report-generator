# 🚀 Smart Activity Report Generator

### AI-Powered Social Activity Documentation & Report Generation Platform

An intelligent web application that simplifies the process of creating social activity reports using AI-powered image analysis. Upload activity photographs, provide basic details, and automatically generate professionally structured reports in **DOCX, PDF, and PPTX formats**.

<p align="center">
  <a href="https://smart-activity-report-generator.vercel.app/">
    <strong>🌐 Live Demo</strong>
  </a>
</p>

---

## 📌 Project Overview

The **Smart Activity Report Generator** is designed to automate and simplify social activity documentation for students, educational institutions, and organizations.

Traditionally, preparing social activity reports requires manually writing descriptions, organizing photographs, arranging documentation, and formatting reports. This application reduces that effort by leveraging Google's Gemini Vision AI to analyze uploaded activity photographs and generate meaningful descriptions.

Users can enter activity details, upload photographs and Proof of Completion (POC) documents, and generate structured reports in multiple downloadable formats.

## ✨ Key Features

- **AI-Powered Image Analysis:** Uses Google Gemini Vision AI to analyze uploaded activity photographs.
- **Automatic Description Generation:** Generates meaningful 2–3 sentence descriptions based on activity images.
- **Multiple Activity Management:** Add and manage multiple social activities in one report.
- **POC Document Upload:** Upload Proof of Completion documents for individual activities.
- **Professional Report Generation:** Automatically organizes activity information into structured reports.
- **Multiple Export Formats:** Download reports in DOCX, PDF, and PPTX formats.
- **Professional Formatting:** Includes a title page, index page, activity details, photographs, and descriptions.
- **Image Optimization:** Uses Sharp to optimize images before processing.
- **Responsive Interface:** React-based user interface for convenient report preparation.

## 🌐 Live Demo

**Try the application here:**

https://smart-activity-report-generator.vercel.app/

## 🛠️ Technology Stack

### Frontend

| Technology | Purpose |
|---|---|
| React.js | Building the user interface |
| Vite | Frontend development and build tool |
| JavaScript | Application logic |
| HTML5 | Page structure |
| CSS3 | Styling and responsive design |
| Axios / Fetch API | Frontend-backend communication |

### Backend

| Technology | Purpose |
|---|---|
| Node.js | Backend runtime |
| Express.js | REST API development |
| Multer | Handling image uploads |
| Sharp | Image processing and optimization |
| dotenv | Environment variable management |

### Artificial Intelligence

| Technology | Purpose |
|---|---|
| Google Gemini Vision API | Image understanding and analysis |
| @google/genai | Official Google Gen AI Node.js SDK |

### Document Generation

| Library | Purpose |
|---|---|
| docx | Generating Word documents |
| PDFKit | Generating PDF documents |
| PptxGenJS | Generating PowerPoint presentations |

### Deployment & Development Tools

- Git and GitHub – Version control and source code management.
- Vercel – Frontend hosting.
- Render – Backend hosting.
- Visual Studio Code – Development environment.
- Postman – API testing.

## 🏗️ System Architecture

```text
              USER
                |
                v
       REACT + VITE FRONTEND
                |
                v
        EXPRESS REST APIs
                |
          +-----+------+
          |            |
          v            v
     MULTER + SHARP   GEMINI VISION AI
          |            |
          +------+-----+
                 |
                 v
        ACTIVITY REPORT DATA
                 |
          +------+------+ 
          |      |      |
          v      v      v
         DOCX   PDF    PPTX
          |      |      |
          +------+------+ 
                 |
                 v
         DOWNLOAD REPORT
```

## ⚙️ Installation & Setup

Follow these steps to run the project locally.

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
```

Navigate into the project directory:

```bash
cd smart-activity-report
```

### 2. Install Frontend Dependencies

```bash
cd client
npm install
```

### 3. Install Backend Dependencies

Open another terminal:

```bash
cd server
npm install
```

### 4. Configure Environment Variables

Create a `.env` file inside the `server` directory.

```env
PORT=5000
FRONTEND_URL=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_gemini_model
```

Create a `.env` file inside the `client` directory.

```env
VITE_API_BASE_URL=http://localhost:5000
```

**Important:**
- Obtain your Gemini API key from Google AI Studio.
- Never expose your Gemini API key in frontend code.
- Never commit `.env` files to GitHub.
- Use the actual production backend URL for the production frontend environment.

### 5. Start the Backend

```bash
cd server
npm start
```

Backend runs at:

```text
http://localhost:5000
```

### 6. Start the Frontend

Open another terminal:

```bash
cd client
npm run dev
```

Frontend runs at:

```text
http://localhost:5173
```

The frontend and backend must both be running during local development.

## 📖 How to Use the Application

1. Open the Smart Activity Report Generator.
2. Enter the required report information, such as college and student details.
3. Add your social activities.
4. Upload photographs for each activity.
5. Upload the corresponding Proof of Completion (POC) document.
6. Use the AI description generation feature to generate activity descriptions from photographs.
7. Review and edit the generated descriptions if necessary.
8. Complete the details for all activities.
9. Generate the final social activity report.
10. Download your report in your preferred format:
    - Microsoft Word (.docx)
    - PDF (.pdf)
    - PowerPoint (.pptx)

## 🔗 API Endpoints

The backend provides REST API endpoints for report submission and document generation.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Backend health check |
| POST | `/api/reports/submit` | Submit report information |
| POST | `/api/reports/generate/docx` | Generate Word report |
| POST | `/api/reports/generate/pdf` | Generate PDF report |
| POST | `/api/reports/generate/pptx` | Generate PowerPoint report |

The AI image-description functionality also uses dedicated activity-description endpoints.

## ☁️ Deployment

The application uses separate hosting platforms for the frontend and backend.

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| AI Service | Google Gemini API |

### Frontend Deployment

1. Connect the GitHub repository to Vercel.
2. Configure the frontend root directory as `client`.
3. Configure the required environment variable:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
```

4. Build command:

```bash
npm run build
```

5. Deploy the application.

### Backend Deployment

1. Create a Web Service on Render.
2. Connect the GitHub repository.
3. Configure the backend root directory as `server`.
4. Configure the build command:

```bash
npm install
```

5. Configure the start command:

```bash
npm start
```

6. Add the required backend environment variables:

```env
PORT=5000
FRONTEND_URL=https://your-frontend.vercel.app
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_gemini_model
```

Render provides the production port automatically. The backend must listen on the assigned port.

**Production URL:** https://smart-activity-report-generator.vercel.app/

## 🔐 Security & Best Practices

- Store API keys securely using environment variables.
- Keep sensitive configuration out of the GitHub repository.
- Validate uploaded images and documents.
- Configure CORS to allow trusted frontend origins.
- Handle API errors appropriately.
- Avoid exposing sensitive backend information to clients.

## 🚀 Future Enhancements

- Support additional report export formats.
- Add user authentication and role-based access.
- Provide cloud storage for generated reports and uploaded images.
- Introduce report history and retrieval.
- Add multilingual activity descriptions.
- Support institution-specific report templates.
- Add collaborative report preparation.

## 🤝 Contributing

Contributions, suggestions, and improvements are welcome!

1. Fork the repository.
2. Create a new feature branch.
3. Implement your changes.
4. Commit your changes.
5. Submit a Pull Request.

## 📄 License

Add an appropriate open-source license to the repository before distributing the project. No license is currently specified here.

## 👨‍💻 Developed With

Built using React, Node.js, Google Gemini Vision AI, and modern document-generation technologies.

**Smart Activity Report Generator – Making Social Activity Documentation Smarter, Faster, and Easier.**

---

<p align="center">
  ⭐ If you find this project useful, consider giving the repository a star!
</p>
