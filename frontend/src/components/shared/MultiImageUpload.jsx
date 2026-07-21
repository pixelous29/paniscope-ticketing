import React, { useRef, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { Upload, X } from 'lucide-react';

/**
 * Composant pour gérer l'upload multiple d'images et le collage via Ctrl+V
 * supportant le presse-papier système (captures d'écran, etc.)
 */
export default function MultiImageUpload({ 
  id = `multi-image-input-${Math.random().toString(36).substr(2, 9)}`,
  images = [], 
  previews = [], 
  onAddImage, 
  onRemoveImage, 
  error,
  maxImages = 4 
}) {
  const fileInputRef = useRef(null);

  // Écoute des événements de collage (Ctrl+V) depuis le presse-papier
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.defaultPrevented) return;
      if (!images || images.length >= maxImages) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      let imagePasted = false;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type && items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            const extension = items[i].type.split('/')[1] || 'png';
            const fileName = (file.name && file.name !== 'image.png') 
              ? file.name 
              : `capture_${Date.now()}.${extension}`;
            const namedFile = new File([file], fileName, { type: file.type });
            onAddImage(namedFile);
            imagePasted = true;
          }
        }
      }
      if (imagePasted) {
        e.preventDefault();
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [images, maxImages, onAddImage]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onAddImage(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="mb-4">
      {error && <div className="text-danger small mb-2">{error}</div>}

      <div className="d-flex flex-wrap gap-2 align-items-center mb-1 mt-2">
        {/* Afficher les images déjà sélectionnées */}
        {previews.map((preview, index) => (
          <div key={index} className="position-relative border rounded shadow-sm bg-light d-flex align-items-center justify-content-center p-1" style={{ width: '70px', height: '70px' }}>
            <img 
              src={preview} 
              alt={`Aperçu ${index + 1}`} 
              className="img-fluid rounded"
              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
            />
            <Button 
              variant="danger" 
              className="position-absolute top-0 end-0 rounded-circle shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveImage(index);
              }}
              style={{ padding: '0px', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'translate(40%, -40%)' }}
            >
              <X size={12} />
            </Button>
          </div>
        ))}

        {/* Placeholder pour ajouter une nouvelle image si la limite n'est pas atteinte */}
        {images.length < maxImages && (
          <label 
            htmlFor={id}
            className="border rounded text-center d-flex flex-column align-items-center justify-content-center text-secondary mb-0"
            style={{ 
              borderStyle: 'dashed',
              borderWidth: '2px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              minWidth: '200px',
              height: '70px',
              padding: '0 12px',
              backgroundColor: '#f8f9fa',
              opacity: '0.8'
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.borderColor = '#0d6efd'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.borderColor = '#dee2e6'; }}
            title="Ajouter une photo ou coller une capture (Ctrl+V)"
          >
            <div className="d-flex align-items-center gap-2">
               <Upload size={18} />
               <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Ajouter ou coller (Ctrl+V)</span>
            </div>
            <span style={{ fontSize: '0.65rem', marginTop: '4px', opacity: 0.7 }}>
               (Max {maxImages} - Reste {maxImages - images.length})
            </span>
          </label>
        )}
      </div>

      <input 
        id={id}
        type="file" 
        ref={fileInputRef}
        onChange={handleImageChange}
        accept="image/*"
        className="d-none"
      />
    </div>
  );
}
