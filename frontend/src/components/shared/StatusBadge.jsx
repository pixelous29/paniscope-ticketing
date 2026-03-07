import React from 'react';
import { Badge, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { STATUS_VARIANT, STATUS_DESCRIPTION } from '../../constants/status';
import { useAuth } from '../../hooks/useAuth';

export default function StatusBadge({ status, className = "" }) {
    const { userRole } = useAuth();
    const role = userRole || 'client'; // Par défaut client
    const roleDescriptions = STATUS_DESCRIPTION[role] || STATUS_DESCRIPTION.client;
    
    // Si la description n'existe pas, on met un message par défaut court
    const desc = roleDescriptions[status] || "Information de statut.";
    const variant = STATUS_VARIANT[status] || 'secondary';

    return (
        <OverlayTrigger
            placement="top"
            overlay={<Tooltip id={`tooltip-status-${status.replace(/\s+/g, '-')}`}>{desc}</Tooltip>}
        >
            <Badge bg={variant} pill className={className} style={{ cursor: 'help' }}>
                {status}
            </Badge>
        </OverlayTrigger>
    );
}
