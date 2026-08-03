import { useState } from "react";
import socket from "../socket/socket";

const Home = () => {

    const [username, setUsername] = useState("");

    const createRoom = () => {

        if (!username) {
            return alert("Enter Username");
        }

        socket.connect();

        socket.emit(
            "create-room",
            { username },
            (response) => {

                console.log(response);

                if (response.success) {
                    alert(`Room Created : ${response.roomId}`);
                } else {
                    alert(response.message);
                }
            }
        );
    };

    return (
        <div
            style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                height: "100vh",
                flexDirection: "column",
                gap: "15px",
            }}
        >
            <h1>YouTube Watch Party</h1>

            <input
                type="text"
                placeholder="Enter Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />

            <button onClick={createRoom}>
                Create Room
            </button>

        </div>
    );
};

export default Home;