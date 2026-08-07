/**
 * ExploreMap's stylesheet (IMP-070).
 *
 * 981 of the component's 2,096 lines were these two blocks — 47% of the file was CSS. They are
 * copied out unchanged; the only thing that moved is where they live.
 *
 * **The two blocks are not interchangeable, and the split is load-bearing.** `mapStyles` is scoped:
 * it styles the markup React renders — the wrapper, the sidebar, the control clusters. `mapGlobal`
 * is not scoped, because it styles DOM **Leaflet** creates imperatively through `L.divIcon` and
 * `bindPopup` — marker pins, cluster bubbles, popups, tooltips. Those nodes never pass through
 * React, so styled-jsx has no element to put a scoping class on, and a scoped rule would match
 * nothing. Whoever wrote this originally got that boundary right; it is preserved exactly.
 *
 * `css` and `css.global` from `styled-jsx/css` are what make an external file work at all: a
 * plain template string handed to `<style jsx>` is not transformed, and the scoping would be lost.
 *
 * **Why this is one file and not three.** The obvious next step — sidebar styles with `MapSidebar`,
 * control styles with `MapControls` — would change what the page looks like, because the two halves
 * are coupled through the **cascade**. Three rules are declared twice at equal specificity, so today
 * the later declaration reaches elements in the earlier one's section:
 *
 *   - `.stat` is defined for the sidebar (`font-size: .75rem; color: #6b7280`) and again for the
 *     map counters (`font-weight: 500`). Both currently apply to both.
 *   - `.check-icon` likewise: the sidebar's `color` is overridden by the controls' declaration,
 *     which also adds `margin-left: auto` to the sidebar's icon.
 *
 * Splitting them into separately scoped sheets would silently drop those inherited declarations.
 * The real fix is to stop two unrelated components sharing generic class names — logged, not done
 * here, because it changes the rendered output and this sprint moves code without changing it.
 */
import css from 'styled-jsx/css';

/** Scoped — applies to the elements ExploreMap itself renders. */
export const mapStyles = css`
  .map-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    border-radius: 0.75rem;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .map-wrapper.fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    border-radius: 0;
  }

  .map-container {
    width: 100%;
    height: 100%;
    background-color: #f3f4f6;
  }

  .map-loading {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.9);
    z-index: 10;
    backdrop-filter: blur(4px);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid #e5e7eb;
    border-top-color: #4f46e5;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .map-error-container {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f3f4f6;
    border-radius: 0.75rem;
  }

  .map-error {
    background-color: white;
    padding: 2rem;
    border-radius: 0.5rem;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
    text-align: center;
    max-width: 400px;
  }

  .error-icon {
    font-size: 2.5rem;
    color: #ef4444;
    margin-bottom: 1rem;
  }

  .map-error h3 {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #1f2937;
  }

  .map-error p {
    color: #6b7280;
    margin-bottom: 1.5rem;
  }

  .map-error button {
    background-color: #4f46e5;
    color: white;
    border: none;
    padding: 0.5rem 1.5rem;
    border-radius: 0.375rem;
    font-weight: 500;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .map-error button:hover {
    background-color: #4338ca;
  }

  .refresh-icon {
    margin-right: 0.5rem;
  }

  .map-sidebar {
    position: absolute;
    top: 0;
    right: 0;
    width: 320px;
    height: 100%;
    background-color: white;
    box-shadow: -4px 0 15px rgba(0, 0, 0, 0.1);
    z-index: 1000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .sidebar-header {
    padding: 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #e5e7eb;
  }

  .sidebar-header h3 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #1f2937;
    display: flex;
    align-items: center;
  }

  .sidebar-icon {
    margin-right: 0.5rem;
    color: #4f46e5;
  }

  .close-button {
    background: none;
    border: none;
    cursor: pointer;
    color: #6b7280;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: background-color 0.2s;
  }

  .close-button:hover {
    background-color: #f3f4f6;
    color: #1f2937;
  }

  .sidebar-search {
    padding: 1rem;
    position: relative;
  }

  .sidebar-search-input {
    width: 100%;
    padding: 0.5rem 2.5rem 0.5rem 2.5rem;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    background-color: #f9fafb;
    font-size: 0.875rem;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
  }

  .sidebar-search-input:focus {
    outline: none;
    border-color: #4f46e5;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
    background-color: white;
  }

  .search-icon {
    position: absolute;
    left: 1.5rem;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    pointer-events: none;
  }

  .clear-search {
    position: absolute;
    right: 1.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    cursor: pointer;
    color: #9ca3af;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
  }

  .clear-search:hover {
    color: #4b5563;
  }

  .sidebar-stats {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }

  .stat {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    color: #6b7280;
  }

  .stat-label {
    margin-right: 0.25rem;
  }

  .stat-value {
    font-weight: 600;
    color: #4b5563;
  }

  .sidebar-places {
    flex-grow: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .no-places {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    text-align: center;
    color: #6b7280;
  }

  .info-icon {
    font-size: 1.5rem;
    color: #9ca3af;
    margin-bottom: 0.5rem;
  }

  .place-item {
    display: flex;
    align-items: center;
    padding: 0.75rem;
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
    cursor: pointer;
    transition: background-color 0.2s;
    border: 1px solid transparent;
  }

  .place-item:hover {
    background-color: #f3f4f6;
  }

  .place-item.selected {
    background-color: #eef2ff;
    border-color: #c7d2fe;
  }

  .place-item.not-visible {
    opacity: 0.6;
  }

  .place-icon {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #f3f4f6;
    border-radius: 50%;
    margin-right: 0.75rem;
  }

  .place-item.selected .place-icon {
    background-color: #4f46e5;
    color: white;
  }

  .visible-icon,
  .pin-icon {
    color: #4b5563;
  }

  .place-item.selected .visible-icon,
  .place-item.selected .pin-icon {
    color: white;
  }

  .place-info {
    flex-grow: 1;
  }

  .place-info h4 {
    font-size: 0.875rem;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 0.25rem;
  }

  .place-info p {
    font-size: 0.75rem;
    color: #6b7280;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }

  .place-rating {
    display: flex;
    align-items: center;
    font-size: 0.75rem;
    color: #1f2937;
    margin-top: 0.25rem;
  }

  .star-icon {
    color: #fbbf24;
    margin-right: 0.25rem;
  }

  .review-count {
    color: #6b7280;
    margin-left: 0.25rem;
  }

  .place-actions {
    display: flex;
    align-items: center;
  }

  .arrow-icon,
  .check-icon {
    color: #6b7280;
  }

  .place-item.selected .arrow-icon,
  .place-item.selected .check-icon {
    color: #4f46e5;
  }

  .sidebar-footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid #e5e7eb;
    font-size: 0.75rem;
    color: #6b7280;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background-color: #f9fafb;
  }

  .sidebar-footer p {
    display: flex;
    align-items: center;
  }

  .info-icon-small {
    margin-right: 0.25rem;
    font-size: 0.875rem;
  }

  .attribution {
    display: flex;
    justify-content: space-between;
    color: #9ca3af;
    font-size: 0.7rem;
  }

  .map-control {
    position: absolute;
    z-index: 500;
  }

  .map-control.top-left {
    top: 1rem;
    left: 1rem;
    display: flex;
    align-items: center;
  }

  .map-control.top-right {
    top: 1rem;
    right: 1rem;
    display: flex;
    gap: 0.5rem;
  }

  .map-control.bottom-center {
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
  }

  .map-control.custom-zoom {
    top: 50%;
    right: 1rem;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .map-control.geolocate-control {
    bottom: 5rem;
    right: 1rem;
    width: 40px;
    height: 40px;
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    border: none;
    color: #4b5563;
    transition: background-color 0.2s;
  }

  .map-control.geolocate-control:hover {
    background-color: #f9fafb;
  }

  .search-container {
    position: relative;
    margin-right: 0.5rem;
  }

  .search-input {
    width: 240px;
    padding: 0.5rem 2.5rem 0.5rem 2.5rem;
    border: none;
    border-radius: 9999px;
    background-color: white;
    font-size: 0.875rem;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.1),
      0 1px 2px rgba(0, 0, 0, 0.06);
    transition:
      width 0.2s,
      box-shadow 0.2s;
  }

  .search-input:focus {
    outline: none;
    width: 280px;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .control-button {
    background-color: white;
    border: none;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #4b5563;
    cursor: pointer;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.1),
      0 1px 2px rgba(0, 0, 0, 0.06);
    transition: background-color 0.2s;
  }

  .control-button:hover {
    background-color: #f9fafb;
  }

  .control-button svg {
    margin-right: 0.5rem;
  }

  .control-button.sidebar-toggle svg {
    font-size: 1rem;
  }

  .control-button.layers-button {
    padding: 0.5rem;
    margin-right: 0.5rem;
  }

  .control-button.fullscreen-button {
    padding: 0.5rem;
    width: 40px;
    height: 40px;
  }

  .control-button.fullscreen-button svg {
    margin-right: 0;
  }

  .map-style-switcher {
    position: relative;
  }

  .map-style-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    background-color: white;
    border-radius: 0.5rem;
    box-shadow:
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 4px 6px -2px rgba(0, 0, 0, 0.05);
    width: 200px;
    z-index: 30;
    overflow: hidden;
  }

  .style-option {
    display: flex;
    align-items: center;
    padding: 0.75rem 1rem;
    cursor: pointer;
    background: none;
    border: none;
    width: 100%;
    text-align: left;
    font-size: 0.875rem;
    color: #4b5563;
    transition: background-color 0.2s;
  }

  .style-option:hover {
    background-color: #f3f4f6;
  }

  .style-option.active {
    background-color: #eef2ff;
    color: #4f46e5;
    font-weight: 500;
  }

  .style-option svg {
    margin-right: 0.75rem;
    font-size: 1.125rem;
  }

  .check-icon {
    margin-left: auto;
    color: #4f46e5;
  }

  .style-dropdown-footer {
    padding: 0.75rem 1rem;
    border-top: 1px solid #e5e7eb;
    background-color: #f9fafb;
  }

  .cluster-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    background: none;
    border: none;
    padding: 0;
    font-size: 0.875rem;
    color: #4b5563;
    cursor: pointer;
  }

  .toggle-switch {
    width: 36px;
    height: 20px;
    background-color: #e5e7eb;
    border-radius: 9999px;
    position: relative;
    transition: background-color 0.2s;
  }

  .toggle-switch.on {
    background-color: #4f46e5;
  }

  .toggle-handle {
    width: 16px;
    height: 16px;
    background-color: white;
    border-radius: 50%;
    position: absolute;
    top: 2px;
    left: 2px;
    transition: transform 0.2s;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  }

  .toggle-switch.on .toggle-handle {
    transform: translateX(16px);
  }

  .map-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    background-color: rgba(255, 255, 255, 0.8);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    backdrop-filter: blur(4px);
    color: #4b5563;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .stat {
    display: flex;
    align-items: center;
    font-weight: 500;
  }

  .stat-icon {
    margin-right: 0.25rem;
    font-size: 0.875rem;
  }

  .zoom-button {
    width: 40px;
    height: 40px;
    background-color: white;
    border: none;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4b5563;
    font-size: 1.125rem;
    cursor: pointer;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.1),
      0 1px 2px rgba(0, 0, 0, 0.06);
    transition: background-color 0.2s;
  }

  .zoom-button:hover {
    background-color: #f9fafb;
  }

  @media (max-width: 768px) {
    .map-wrapper {
      border-radius: 0.5rem;
    }

    .map-control.top-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .search-container {
      margin-right: 0;
      margin-bottom: 0.5rem;
    }

    .search-input {
      width: 180px;
    }

    .search-input:focus {
      width: 220px;
    }

    .control-button span {
      display: none;
    }

    .control-button svg {
      margin-right: 0;
    }

    .map-sidebar {
      width: 100%;
    }

    .map-stats {
      display: none;
    }

    .custom-zoom {
      right: 0.5rem;
    }

    .map-control.geolocate-control {
      bottom: 4rem;
      right: 0.5rem;
    }
  }

  @media (max-width: 480px) {
    .map-control.top-left,
    .map-control.top-right {
      top: 0.5rem;
    }

    .map-control.top-left {
      left: 0.5rem;
    }

    .map-control.top-right {
      right: 0.5rem;
    }

    .search-input {
      width: 150px;
      padding: 0.375rem 2rem 0.375rem 2rem;
    }

    .search-input:focus {
      width: 180px;
    }

    .custom-zoom {
      display: none;
    }
  }
`;

/** Global — applies to the DOM Leaflet builds, which React never touches. */
export const mapGlobal = css.global`
  /* Custom marker styling */
  .custom-marker-icon {
    background: none;
    border: none;
  }

  .marker-pin {
    width: 30px;
    height: 42px;
    background-color: #4f46e5;
    border-radius: 50% 50% 50% 0;
    transform: rotate(-45deg);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    border: 2px solid white;
    position: relative;
  }

  .marker-pin.selected {
    background-color: #ef4444;
    transform: rotate(-45deg) scale(1.2);
    z-index: 1000 !important;
  }

  .marker-icon {
    transform: rotate(45deg);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .rating {
    transform: rotate(45deg);
    color: white;
    font-weight: bold;
    font-size: 12px;
    display: flex;
    align-items: center;
  }

  .rating svg {
    margin-right: 2px;
  }

  .marker-pulse {
    position: absolute;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: rgba(239, 68, 68, 0.4);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: -1;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 1;
    }
    70% {
      opacity: 0.2;
    }
    100% {
      transform: translate(-50%, -50%) scale(1.5);
      opacity: 0;
    }
  }

  /* Cluster marker styling */
  .cluster-marker {
    background-color: #4f46e5;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    border: 3px solid white;
  }

  .cluster-marker.small {
    width: 40px;
    height: 40px;
    font-size: 14px;
  }

  .cluster-marker.medium {
    width: 50px;
    height: 50px;
    font-size: 16px;
  }

  .cluster-marker.large {
    width: 60px;
    height: 60px;
    font-size: 18px;
  }

  /* Custom popup styling */
  .leaflet-popup-content-wrapper {
    padding: 0;
    overflow: hidden;
    border-radius: 8px;
    box-shadow:
      0 4px 6px -1px rgba(0, 0, 0, 0.1),
      0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }

  .leaflet-popup-content {
    margin: 0;
    width: 280px !important;
  }

  .leaflet-popup-tip {
    background-color: white;
  }

  .custom-popup {
    width: 100%;
  }

  .popup-header {
    background-color: #4f46e5;
    color: white;
    padding: 12px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .popup-header h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }

  .popup-header .rating {
    background-color: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 20px;
    font-size: 12px;
    display: flex;
    align-items: center;
    transform: none;
  }

  .popup-body {
    padding: 12px 16px;
    background-color: white;
  }

  .popup-body p {
    margin: 0 0 8px;
    font-size: 14px;
    color: #4b5563;
  }

  .popup-body .description {
    color: #6b7280;
    font-size: 13px;
    line-height: 1.4;
  }

  .popup-footer {
    padding: 12px 16px;
    background-color: #f9fafb;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: flex-end;
  }

  .view-button {
    background-color: #4f46e5;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: background-color 0.2s;
  }

  .view-button:hover {
    background-color: #4338ca;
    text-decoration: none;
    color: white;
  }

  /* Custom tooltip */
  .custom-tooltip {
    background-color: rgba(0, 0, 0, 0.8);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    color: white;
    font-size: 12px;
    font-weight: 500;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  /* Leaflet marker cluster styles */
  .leaflet-marker-cluster {
    background: none !important;
  }

  .leaflet-marker-cluster div {
    background-color: transparent !important;
  }
`;
