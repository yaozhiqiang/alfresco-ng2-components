/*!
 * @license
 * Copyright 2016 Alfresco Software, Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AfterViewInit, Directive, ElementRef, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import { MinimalNodeEntity } from 'alfresco-js-api';
import { AlfrescoContentService } from './../services/alfresco-content.service';

@Directive({
    selector: '[adf-node-permission]'
})
export class NodePermissionDirective implements OnChanges, AfterViewInit {

    @Input('adf-node-permission')
    permission: string = null;

    @Input('adf-nodes')
    nodes: MinimalNodeEntity[] = [];

    constructor(private elementRef: ElementRef,
                private renderer: Renderer2,
                private contentService: AlfrescoContentService) {
    }

    ngAfterViewInit() {
        this.updateElement();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes.nodes && !changes.nodes.firstChange) {
            this.updateElement();
        }
    }

    /**
     * Updates disabled state for the decorated elememtn
     *
     * @returns {boolean} True if decorated element got disabled, otherwise False
     * @memberof NodePermissionDirective
     */
    updateElement(): boolean {
        let enable = true;

        if (this.nodes && this.nodes.length > 0) {
            for (let node of this.nodes) {
                if (!this.contentService.hasPermission(node.entry, this.permission)) {
                    enable = false;
                    break;
                }
            }
        } else {
            enable = false;
        }

        if (enable) {
            this.enableElement();
        } else {
            this.disableElement();
        }

        return enable;
    }

    /**
     * Enables decorated element
     *
     * @memberof NodePermissionDirective
     */
    enableElement() {
        this.renderer.removeAttribute(this.elementRef.nativeElement, 'disabled');
    }

    /**
     * Disables decorated element
     *
     * @memberof NodePermissionDirective
     */
    disableElement() {
        this.renderer.setAttribute(this.elementRef.nativeElement, 'disabled', 'true');
    }

}
