import React from 'react';
import { Modal, Button } from 'react-bootstrap';
import { X, ZoomIn, ZoomOut, Maximize, Download } from 'lucide-react';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

export default function ImageModal({ show, onHide, imageUrl, altText = "Aperçu de l'image" }) {
  const handleDownload = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `capture_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error("Erreur de téléchargement", err);
      alert("Impossible de télécharger l'image directement. Veuillez vérifier votre connexion.");
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="xl" centered contentClassName="bg-transparent border-0">
      <div className="position-relative d-flex justify-content-center align-items-center w-100" style={{ height: '90vh' }}>
        <Button 
          variant="light" 
          onClick={onHide} 
          className="position-absolute top-0 end-0 m-3 rounded-circle shadow p-2"
          style={{ zIndex: 1055 }}
        >
          <X size={24} />
        </Button>
        <div className="bg-white rounded shadow-lg overflow-hidden w-100 h-100 d-flex justify-content-center align-items-center position-relative">
            <TransformWrapper
                initialScale={1}
                minScale={0.5}
                maxScale={8}
                centerOnInit={true}
                wheel={{ step: 0.1 }}
            >
                {({ zoomIn, zoomOut, resetTransform }) => (
                    <React.Fragment>
                        <div className="position-absolute top-0 start-50 translate-middle-x mt-3 d-flex gap-2 align-items-center" style={{ zIndex: 1055 }}>
                            <Button variant="dark" className="rounded-circle shadow p-0 opacity-75 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }} onClick={() => zoomIn(0.25)} title="Zoom avant">
                                <ZoomIn size={20} />
                            </Button>
                            <Button variant="dark" className="rounded-circle shadow p-0 opacity-75 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }} onClick={() => zoomOut(0.25)} title="Zoom arrière">
                                <ZoomOut size={20} />
                            </Button>
                            <Button variant="dark" className="rounded-circle shadow p-0 opacity-75 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }} onClick={() => resetTransform()} title="Réinitialiser">
                                <Maximize size={20} />
                            </Button>
                            <div className="bg-secondary rounded mx-1" style={{ width: '1px', height: '24px', opacity: 0.5 }}></div>
                            <Button variant="primary" className="rounded-circle shadow p-0 d-flex align-items-center justify-content-center" style={{ width: '42px', height: '42px' }} onClick={handleDownload} title="Télécharger l'image">
                                <Download size={20} />
                            </Button>
                        </div>
                        <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }}>
                            <img 
                            src={imageUrl} 
                            alt={altText} 
                            className="img-fluid" 
                            style={{ maxHeight: '90vh', maxWidth: '100%', objectFit: 'contain' }}
                            />
                        </TransformComponent>
                    </React.Fragment>
                )}
            </TransformWrapper>
        </div>
      </div>
    </Modal>
  );
}
