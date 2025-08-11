# AI Site Builder

This project is a full-stack web application designed to generate websites using an AI-powered assistant. It features a React-based frontend for user interaction and a Node.js backend to handle logic, site generation, and database operations.

## Project Structure

The repository is organized into two main parts:

-   `/frontend`: A modern React application (created with Create React App) that provides the user interface for building and managing websites.
-   `/backend`: A Node.js server using the Express framework. It serves the API, interacts with a SQLite database, and contains the core logic for generating static HTML sites.

## Technologies Used

-   **Frontend**: React, React Scripts, CSS
-   **Backend**: Node.js, Express.js, SQLite (`better-sqlite3`), EJS, OpenAI API

## Prerequisites

-   [Node.js](https://nodejs.org/) (v16 or higher recommended)
-   [npm](https://www.npmjs.com/) (Node Package Manager)

## Installation

To get the project running locally, you'll need to set up both the backend and frontend services.

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure environment variables:**
    Create a `.env` file by copying the example file.
    ```bash
    cp .env.example .env
    ```
    Open the `.env` file and add your OpenAI API key. The application can run without it, but AI features will not be available.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd ../frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

## Running the Application

Both the backend and frontend servers must be running concurrently.

1.  **Start the Backend Server:**
    In the `/backend` directory, run:
    ```bash
    npm start
    ```
    The API server will start on `http://localhost:3000`.

2.  **Start the Frontend Development Server:**
    In a separate terminal, from the `/frontend` directory, run:
    ```bash
    npm start
    ```
    This will launch the React application in your default browser, typically at `http://localhost:3001`. The frontend is configured to proxy API requests to the backend server.

Once both services are running, you can access the application through the browser window opened by the frontend script.

## Özellikler
- "Yeni Site Oluştur" butonu ile `public/sites/{siteId}/index.html` dosyası oluşturulur.
- Chatbot endpoint (`/api/chatbot`) şimdilik stub olarak bırakıldı (çalışmaz).


