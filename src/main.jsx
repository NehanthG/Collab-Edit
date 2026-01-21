import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Room from "./Room.jsx";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css"; // tailwind is imported here

ReactDOM.createRoot(document.getElementById("root")).render(
  <>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/room/:id" element={<Room />} />
      </Routes>
    </BrowserRouter>
  </>
);
