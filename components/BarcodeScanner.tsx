"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { apiGet } from "@/lib/client";
import type { Book } from "@/lib/types";

type Props = {
  onClose: () => void;
  onSuccess: (book: Book) => void;
};

/** ISBN-10 ou ISBN-13 (les EAN de livres commencent par 978/979). */
function isIsbnLike(code: string): boolean {
  const clean = code.replace(/[\s-]/g, "");
  return /^(97[89]\d{10}|\d{9}[\dXx])$/.test(clean);
}

export default function BarcodeScanner({ onClose, onSuccess }: Props) {
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [cameraFailed, setCameraFailed] = useState(false);
  const [manualIsbn, setManualIsbn] = useState("");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);
  const containerId = "barcode-scanner-container";

  async function lookupIsbn(code: string, scanner?: Html5Qrcode | null) {
    setLoading(true);
    setErrorMsg("");
    try {
      const results = await apiGet<Book[]>(
        `/api/books?isbn=${encodeURIComponent(code.replace(/[\s-]/g, ""))}`
      );
      if (results && results.length > 0) {
        onSuccess(results[0]);
        return;
      }
      setErrorMsg(`Livre non trouvé pour l'ISBN ${code}`);
    } catch {
      setErrorMsg("Erreur lors de la recherche du livre.");
    } finally {
      setLoading(false);
    }
    // Échec : on relance le scan après 2,5 s
    setTimeout(() => {
      setErrorMsg("");
      busyRef.current = false;
      try {
        if (scanner?.isScanning) scanner.resume();
      } catch {
        /* déjà arrêté */
      }
    }, 2500);
  }

  useEffect(() => {
    let activeScanner: Html5Qrcode | null = null;

    const startCamera = async () => {
      try {
        // Formats des codes-barres de livres uniquement + détecteur natif
        // du navigateur quand disponible (bien meilleur sur les codes 1D
        // que le décodeur par défaut, pensé pour les QR).
        const scanner = new Html5Qrcode(containerId, {
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
          ],
          useBarCodeDetectorIfSupported: true,
          verbose: false,
        });
        activeScanner = scanner;
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (width, height) => ({
              width: Math.min(width * 0.85, 320),
              height: Math.min(height * 0.4, 150),
            }),
            aspectRatio: 1.333,
          },
          (decodedText) => {
            if (busyRef.current) return;
            // Un livre peut porter un 2e code (prix) : on ignore le reste
            if (!isIsbnLike(decodedText)) return;
            busyRef.current = true;
            try {
              scanner.pause(true);
            } catch {
              /* ignore */
            }
            void lookupIsbn(decodedText, scanner);
          },
          () => {
            // Échecs de lecture image par image : normal pendant le scan
          }
        );
      } catch (err) {
        console.error("Camera start error:", err);
        setCameraFailed(true);
        setErrorMsg(
          "Caméra inaccessible — vérifiez les permissions, ou saisissez l'ISBN ci-dessous."
        );
      }
    };

    const timer = setTimeout(() => {
      void startCamera();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (activeScanner && activeScanner.isScanning) {
        activeScanner.stop().catch(console.error);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {!loading && !cameraFailed && (
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
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          Cadrez le code-barres au dos du livre (il commence par 978 ou 979)
        </p>
        {/* Secours : saisie manuelle de l'ISBN */}
        <form
          className="row"
          style={{ gap: 8, width: "100%", maxWidth: 360 }}
          onSubmit={(e) => {
            e.preventDefault();
            const code = manualIsbn.trim();
            if (!isIsbnLike(code)) {
              setErrorMsg("ISBN invalide — 10 ou 13 chiffres attendus.");
              return;
            }
            busyRef.current = true;
            void lookupIsbn(code, scannerRef.current);
          }}
        >
          <div className="glass search" style={{ flex: 1, margin: 0, padding: "10px 16px" }}>
            <input
              inputMode="numeric"
              placeholder="…ou tapez l'ISBN"
              value={manualIsbn}
              onChange={(e) => setManualIsbn(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary pressable"
            style={{ padding: "10px 18px" }}
            disabled={loading || !manualIsbn.trim()}
          >
            OK
          </button>
        </form>
      </div>
    </div>
  );
}
