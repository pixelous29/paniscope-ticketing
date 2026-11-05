import React from 'react';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { STATUS_VARIANT, STATUS_DESCRIPTION, STATUS_LABEL } from '../../constants/status';
import { useAuth } from '../../hooks/useAuth';

export default function StatusBadge({ status, className = "" }) {
    const { userRole } = useAuth();
    const role = userRole || 'client'; // Par défaut client
    const roleDescriptions = STATUS_DESCRIPTION[role] || STATUS_DESCRIPTION.client;
    const roleLabels = STATUS_LABEL[role] || STATUS_LABEL.client;
    
    // Si la description n'existe pas, on met un message par défaut court
    const desc = roleDescriptions[status] || "Information de statut.";
    const label = roleLabels[status] || status;
    const variant = STATUS_VARIANT[status] || 'secondary';
    const textColor = (variant === 'warning' || variant === 'light' || variant === 'info') ? 'dark' : 'white';

    return (
        <OverlayTrigger
            placement="bottom"
            overlay={<Tooltip id={`tooltip-status-${(status || 'unknown').replace(/\s+/g, '-')}`}>{desc}</Tooltip>}
        >
            <Badge bg={variant} text={textColor} pill className={`text-nowrap ${className}`} style={{ cursor: 'help' }}>
                {label}
            </Badge>
        </OverlayTrigger>
    );
}
