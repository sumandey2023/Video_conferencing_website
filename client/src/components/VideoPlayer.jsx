import { useEffect, useRef, useState } from "react";

const VideoPlayer = ({ peer }) => {
  const ref = useRef();
  const [peerName, setPeerName] = useState("Peer");

  useEffect(() => {
    peer.on("stream", (stream) => {
      ref.current.srcObject = stream;
    });
  }, [peer]);

  return (
    <div className="video-item">
      <video playsInline autoPlay ref={ref} className="video-player" />
      <div className="user-name">{peerName}</div>
    </div>
  );
};

export default VideoPlayer;
