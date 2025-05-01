import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

const Home = () => {
  const [roomID, setRoomID] = useState("");
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  const createRoom = async () => {
    const id = uuidv4();
    try {
      await axios.post("http://localhost:5000/api/rooms", { roomId: id });

      if (userName) {
        localStorage.setItem("userName", userName);
      }
      navigate(`/room/${id}`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Failed to create room. Please try again.");
    }
  };

  const joinRoom = () => {
    if (roomID) {
      if (userName) {
        localStorage.setItem("userName", userName);
      }
      navigate(`/room/${roomID}`);
    } else {
      alert("Please enter a room ID");
    }
  };

  return (
    <div className="home-container">
      <h1>Video Conference App</h1>
      <div className="form-container">
        <div className="input-container">
          <label>Your Name (optional)</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
        </div>

        <div className="room-controls">
          <div className="join-room">
            <label>Join an existing room</label>
            <div className="join-container">
              <input
                type="text"
                placeholder="Enter Room ID"
                value={roomID}
                onChange={(e) => setRoomID(e.target.value)}
              />
              <button onClick={joinRoom}>Join Room</button>
            </div>
          </div>

          <div className="create-room">
            <label>Or create a new room</label>
            <button onClick={createRoom}>Create Room</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
