import React from 'react';
import './SideSelectionModal.css';

interface Props {
    onSelect: (side: 'head' | 'tail') => void;
    onCancel: () => void;
}

export const SideSelectionModal: React.FC<Props> = ({ onSelect, onCancel }) => {
    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>¿Dónde colocar la ficha?</h3>
                <div className="modal-buttons">
                    <button
                        className="btn-head"
                        onClick={() => onSelect('head')}
                    >
                        ⬅️ Izquierda (Head)
                    </button>
                    <button
                        className="btn-tail"
                        onClick={() => onSelect('tail')}
                    >
                        Derecha (Tail) ➡️
                    </button>
                </div>
                <button className="btn-cancel" onClick={onCancel}>
                    Cancelar
                </button>
            </div>
        </div>
    );
};
