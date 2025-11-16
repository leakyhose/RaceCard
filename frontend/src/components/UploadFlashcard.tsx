import { useState } from "react";
import { socket } from "../socket";
import { ImportModal } from "../components/ImportModal";
import type { Flashcard } from "@shared/types";
import uploadIcon from "@shared/images/upload.svg";

interface UploadFlashcardProps {
  isLeader: boolean;
}

export function UploadFlashcard({ isLeader }: UploadFlashcardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleImport = (flashcards: Flashcard[]) => {
    socket.emit("updateFlashcard", flashcards);
  };

  return (
    <div>
      {isLeader ? (
        <>
          <button onClick={() => setIsModalOpen(true)}>
            <img
              className="h-10 p-1"
              src={uploadIcon}
              alt="Upload flashcards"
            />
          </button>
          <ImportModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onImport={handleImport}
          />
        </>
      ) : (
        <div>Waiting for the leader to upload flashcards...</div>
      )}
    </div>
  );
}
