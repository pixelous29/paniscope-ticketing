import React, { useRef } from 'react';
import { Form, Button, Row, Col } from 'react-bootstrap';
import { Upload, X } from 'lucide-react';

/**
 * Composant pour gérer l'upload multiple d'images
 * @param {Array} images - Tableau des fichiers images sélectionnés
 * @param {Array} previews - Tableau des URLs (Base64) de prévisualisation des images
 * @param {Function} onAddImage - Callback pour ajouter une novelle image
 * @param {Function} onRemoveImage - Callback pour retirer une image spécifique (index)
 * @param {string} error - Éventuelle erreur liée à l'upload ou à la taille des images
 * @param {number} maxImages - Nombre maximum d'images autorisées
 */
export default function MultiImageUpload({ 
  images, 
  previews, 
  onAddImage, 
  onRemoveImage, 
  error,
  maxImages = 4 
}) {
  const fileInputRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onAddImage(file);
      // Reset the file input to allow selecting the same file again if it was removed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Form.Group className="mb-4">
      <Form.Label className="fw-bold mb-2">Captures d'écran en lien avec le message (Max 4 images)</Form.Label>
      
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
          <div 
            className="border rounded text-center d-flex flex-column align-items-center justify-content-center text-secondary"
            style={{ 
              borderStyle: 'dashed',
              borderWidth: '2px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              width: '180px',
              height: '70px',
              backgroundColor: '#f8f9fa',
              opacity: '0.8'
            }}
            onClick={() => fileInputRef.current.click()}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = '#eef2ff'; e.currentTarget.style.borderColor = '#0d6efd'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '0.8'; e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.borderColor = '#dee2e6'; }}
            title="Ajouter une photo ou capture"
          >
            <div className="d-flex align-items-center gap-2">
               <Upload size={18} />
               <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Ajouter une image</span>
            </div>
            <span style={{ fontSize: '0.65rem', marginTop: '4px', opacity: 0.7 }}>
               (Max {maxImages} - Reste {maxImages - images.length})
            </span>
          </div>
        )}
      </div>

      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleImageChange}
        accept="image/*"
        className="d-none"
      />
    </Form.Group>
  );
}
