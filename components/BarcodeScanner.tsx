"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { apiGet } from "@/lib/client";
import type { Book } from "@/lib/types";

type Props = {
  onClose: () => void;
  onSuccess: (book: Book) => void;
};

export default function BarcodeScanner({ onClose, onSuccess }: Props) {
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "barcode-scanner-container";

  useEffect(() => {
    let activeScanner: Html5Qrcode | null = null;
    
    // Start scanner
    const startCamera = async () => {
      try {
        const scanner = new Html5Qrcode(containerId);
        activeScanner = scanner;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              // Custom barcode shape (wide rectangle)
              const boxWidth = Math.min(width * 0.8, 300);
              const boxHeight = Math.min(height * 0.35, 130);
              return { width: boxWidth, height: boxHeight };
            },
          },
          async (decodedText) => {
            try {
              setLoading(true);
              setErrorMsg("");
              
              // Stop scanning immediately to prevent multiple triggers
              await scanner.pause(true);

              const results = await apiGet<Book[]>(`/api/books?isbn=${decodedText}`);
              if (results && results.length > 0) {
                const book = results[0];
                onSuccess(book);
              } else {
                setErrorMsg(`Livre non trouvé pour l'ISBN : ${decodedText}`);
                // Resume after 3 seconds
                setTimeout(() => {
                  if (scanner.isScanning) {
                    scanner.resume();
                  }
                  setErrorMsg("");
                }, 3000);
              }
            } catch (err) {
              console.error(err);
              setErrorMsg("Erreur lors de la recherche du livre.");
              setTimeout(() => {
                if (scanner.isScanning) {
                  scanner.resume();
                }
                setErrorMsg("");
              }, 3000);
            } finally {
              setLoading(false);
            }
          },
          () => {
            // Silently ignore frame read failures (normal during scanning)
          }
        );
      } catch (err: any) {
        console.error("Camera start error:", err);
        setErrorMsg("Impossible d'accéder à la caméra. Veuillez vérifier les permissions.");
      }
    };

    // Wait a brief moment to ensure container element is mounted
    const timer = setTimeout(() => {
      startCamera();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (activeScanner && activeScanner.isScanning) {
        activeScanner.stop().catch(console.error);
      }
    };
  }, [onSuccess]);

  return (
    <div className="scanner-overlay">
      <div className="scanner-header">
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Scanner un code-barres</h2>
        <button className="scanner-close-btn" onClick={onClose} aria-label="Fermer le scanner">
          ✖
        </button>
      </div>

      <div className="scanner-viewport-container">
        <div id={containerId} className="scanner-view" />
        
        {/* Laser scanner animation overlay */}
        {!loading && (
          <div className="scanner-laser-container">
            <div className="scanner-laser" />
            <div className="scanner-target-box" />
          </div>
        )}

        {loading && (
          <div className="scanner-loader-overlay">
            <div className="spinner" />
            <p style={{ marginTop: 12, fontWeight: 600, fontSize: 14 }}>Recherche du livre...</p>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="scanner-error">
          <p>{errorMsg}</p>
        </div>
      )}

      <div className="scanner-footer">
        <p className="muted" style={{ fontSize: 13 }}>Cadrez le code-barres situé au dos du livre</p>
      </div>
    </div>
  );
}
