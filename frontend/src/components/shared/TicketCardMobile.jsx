import React from "react";
import { Card, Badge, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { STATUS, STATUS_VARIANT } from "../../constants/status";
import StatusBadge from "./StatusBadge";

const priorityVariant = {
  Faible: "secondary",
  Normale: "success",
  Haute: "warning",
  Critique: "danger",
};

export default function TicketCardMobile({ ticket, role, onArchive }) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (role === "client") navigate(`/ticket/${ticket.id}`);
    else if (role === "manager") navigate(`/manager/ticket/${ticket.id}`);
    else if (role === "developer") navigate(`/dev/ticket/${ticket.id}`);
  };

  return (
    <Card
      className="mb-3 shadow-sm ticket-card-mobile"
      onClick={handleClick}
      style={{
        cursor: "pointer",
        borderLeft: `4px solid var(--bs-${STATUS_VARIANT[ticket.status] || "secondary"})`,
      }}
    >
      <Card.Body className="p-3">
        <div className="text-secondary fw-semibold mb-2" style={{ fontSize: "0.85rem" }}>
          Ticket N° #{ticket.id}
        </div>
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div
            className="fw-bold pe-2"
            style={{ fontSize: "1.05rem", lineHeight: "1.2" }}
          >
            {ticket.hasNewClientMessage && role !== "client" && (
              <span className="me-2 text-warning">●</span>
            )}
            {ticket.hasNewManagerMessage && role !== "manager" && (
              <span className="me-2 text-primary">●</span>
            )}
            {ticket.hasNewDeveloperMessage && role !== "developer" && (
              <span className="me-2 text-purple" style={{ color: "purple" }}>
                ●
              </span>
            )}
            {ticket.subject}
          </div>
          <div>
            <StatusBadge status={ticket.status} className="px-2 py-1" />
          </div>
        </div>

        <div className="text-muted mb-2" style={{ fontSize: "0.85rem" }}>
          {role !== "client" && (
            <div className="mb-1">
              <i className="bi bi-person me-1"></i>{" "}
              {ticket.clientName || ticket.client || ticket.clientId}
              {ticket.companyDomain && (
                <span className="ms-2 text-muted" style={{ fontSize: "0.8em" }}>
                  ({ticket.companyDomain})
                </span>
              )}
            </div>
          )}
          <div className="d-flex justify-content-between">
            <span>
              <i className="bi bi-clock me-1"></i>
              {ticket.lastUpdate?.toDate 
                ? ticket.lastUpdate.toDate().toLocaleDateString('fr-FR')
                : (ticket.lastUpdate || "Modifié récemment")}
            </span>
            {role !== "client" && ticket.assignedTo && (
              <span>
                <i className="bi bi-person-badge me-1"></i> {ticket.assignedTo}
              </span>
            )}
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-end mt-2">
          <div>
            {ticket.priority && (
              <Badge
                bg={priorityVariant[ticket.priority] || "light"}
                text={
                  priorityVariant[ticket.priority] === "warning"
                    ? "dark"
                    : "white"
                }
                className="me-2"
              >
                {ticket.priority}
              </Badge>
            )}
            {ticket.tags &&
              ticket.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} pill bg="primary" className="me-1">
                  {tag}
                </Badge>
              ))}
            {ticket.tags && ticket.tags.length > 2 && (
              <Badge pill bg="secondary" className="me-1">
                +{ticket.tags.length - 2}
              </Badge>
            )}
          </div>

          {ticket.status === STATUS.CLOSED && onArchive && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onArchive(e, ticket.id);
              }}
            >
              <Button
                variant="outline-secondary"
                size="sm"
                className="p-1 px-2 rounded-circle"
              >
                <i className="bi bi-archive-fill"></i>
              </Button>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
