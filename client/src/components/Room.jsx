import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io from "socket.io-client";
import Peer from "simple-peer";
import VideoPlayer from "./VideoPlayer";
import ChatBox from "./ChatBox";

const Room = () => {
  const [peers, setPeers] = useState([]);
  const [stream, setStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [userName, setUserName] = useState("");

  const socketRef = useRef();
  const userVideo = useRef();
  const peersRef = useRef([]);
  const { roomID } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const storedName = localStorage.getItem("userName") || "Anonymous";
    setUserName(storedName);

    socketRef.current = io.connect("https://your-render-app-url.onrender.com", {
      withCredentials: true,
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setStream(stream);
        userVideo.current.srcObject = stream;

        socketRef.current.emit("join-room", roomID);

        socketRef.current.on("all-users", (users) => {
          const peers = [];
          users.forEach((userID) => {
            const peer = createPeer(userID, socketRef.current.id, stream);
            peersRef.current.push({
              peerID: userID,
              peer,
            });
            peers.push({
              peerID: userID,
              peer,
            });
          });
          setPeers(peers);
        });

        socketRef.current.on("user-joined", (payload) => {
          const peer = addPeer(payload.signal, payload.callerID, stream);
          peersRef.current.push({
            peerID: payload.callerID,
            peer,
          });

          const peerObj = {
            peerID: payload.callerID,
            peer,
          };

          setPeers((peers) => [...peers, peerObj]);
        });

        socketRef.current.on("receiving-returned-signal", (payload) => {
          const item = peersRef.current.find((p) => p.peerID === payload.id);
          item.peer.signal(payload.signal);
        });

        socketRef.current.on("user-disconnected", (id) => {
          const peerObj = peersRef.current.find((p) => p.peerID === id);
          if (peerObj) {
            peerObj.peer.destroy();
          }

          const peers = peersRef.current.filter((p) => p.peerID !== id);
          peersRef.current = peers;
          setPeers(peers);
        });

        // Handle incoming messages
        socketRef.current.on("receive-message", (message, senderName) => {
          setMessages((prevMessages) => [
            ...prevMessages,
            { text: message, sender: senderName, fromMe: false },
          ]);
        });
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
        let errorMessage = "Failed to access camera and microphone. ";

        if (
          err.name === "NotReadableError" ||
          err.message.includes("Device in use")
        ) {
          errorMessage +=
            "Your camera or microphone is currently being used by another application. Please close other applications that might be using your camera or microphone and try again.";
        } else if (err.name === "NotAllowedError") {
          errorMessage +=
            "Please allow camera and microphone access in your browser settings.";
        } else if (err.name === "NotFoundError") {
          errorMessage +=
            "No camera or microphone found. Please connect a camera and microphone and try again.";
        } else {
          errorMessage += "Please check your device permissions and try again.";
        }

        alert(errorMessage);
        navigate("/");
      });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [roomID, navigate]);

  const createPeer = (userToSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("sending-signal", {
        userToSignal,
        callerID,
        signal,
      });
    });

    return peer;
  };

  const addPeer = (incomingSignal, callerID, stream) => {
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current.emit("returning-signal", { signal, callerID });
    });

    peer.signal(incomingSignal);

    return peer;
  };

  const toggleAudio = () => {
    if (stream) {
      stream.getAudioTracks()[0].enabled = !audioEnabled;
      setAudioEnabled(!audioEnabled);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      stream.getVideoTracks()[0].enabled = !videoEnabled;
      setVideoEnabled(!videoEnabled);
    }
  };

  const leaveRoom = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    navigate("/");
  };

  const sendMessage = (message) => {
    if (message.trim() && socketRef.current) {
      socketRef.current.emit("send-message", roomID, message, userName);
      setMessages((prevMessages) => [
        ...prevMessages,
        { text: message, sender: userName, fromMe: true },
      ]);
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomID);
    alert("Room ID copied to clipboard");
  };

  return (
    <div className="room-container">
      <div className="room-header">
        <h2>Room ID: {roomID}</h2>
        <button onClick={copyRoomId} className="copy-btn">
          Copy Room ID
        </button>
        <div className="controls">
          <button
            onClick={toggleAudio}
            className={`control-btn ${!audioEnabled ? "disabled" : ""}`}
          >
            {audioEnabled ? "Mute" : "Unmute"}
          </button>
          <button
            onClick={toggleVideo}
            className={`control-btn ${!videoEnabled ? "disabled" : ""}`}
          >
            {videoEnabled ? "Turn Off Video" : "Turn On Video"}
          </button>
          <button
            onClick={() => setShowChat(!showChat)}
            className="control-btn"
          >
            {showChat ? "Hide Chat" : "Show Chat"}
          </button>
          <button onClick={leaveRoom} className="leave-btn">
            Leave Room
          </button>
        </div>
      </div>

      <div className="content-container">
        <div className={`video-container ${showChat ? "with-chat" : ""}`}>
          <div className="video-item">
            <video
              muted
              ref={userVideo}
              autoPlay
              playsInline
              className="video-player"
            />
            <div className="user-name">You {!audioEnabled && "(Muted)"}</div>
          </div>
          {peers.map((peer) => (
            <VideoPlayer key={peer.peerID} peer={peer.peer} />
          ))}
        </div>

        {showChat && (
          <ChatBox
            messages={messages}
            sendMessage={sendMessage}
            userName={userName}
          />
        )}
      </div>
    </div>
  );
};

export default Room;
