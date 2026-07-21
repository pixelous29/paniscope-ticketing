import React from 'react';
import { Badge } from 'react-bootstrap';
import { TICKET_TYPE, TICKET_TYPE_LABEL, TICKET_TYPE_ICON, TICKET_TYPE_VARIANT } from '../../constants/type';

export default function TypeBadge({ type, className = "", pill = true }) {
  const normalizedType = (type === TICKET_TYPE.EVOLUTION) ? TICKET_TYPE.EVOLUTION : TICKET_TYPE.INCIDENT;
  const label = TICKET_TYPE_LABEL[normalizedType];
  const icon = TICKET_TYPE_ICON[normalizedType];
  const variant = TICKET_TYPE_VARIANT[normalizedType];

  return (
    <Badge bg={variant} pill={pill} className={`fw-semibold align-items-center ${className}`}>
      <i className={`bi ${icon} me-1`}></i>
      {label}
    </Badge>
  );
}
