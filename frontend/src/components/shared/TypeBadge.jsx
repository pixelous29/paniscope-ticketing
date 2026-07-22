import React from 'react';
import { Badge } from 'react-bootstrap';
import { TICKET_TYPE_LABEL, TICKET_TYPE_ICON, TICKET_TYPE_VARIANT } from '../../constants/type';

export default function TypeBadge({ type, className = "", pill = true }) {
  if (!type || !TICKET_TYPE_LABEL[type]) {
    return null;
  }
  const label = TICKET_TYPE_LABEL[type];
  const icon = TICKET_TYPE_ICON[type];
  const variant = TICKET_TYPE_VARIANT[type];

  return (
    <Badge bg={variant} pill={pill} className={`fw-semibold align-items-center ${className}`}>
      <i className={`bi ${icon} me-1`}></i>
      {label}
    </Badge>
  );
}
