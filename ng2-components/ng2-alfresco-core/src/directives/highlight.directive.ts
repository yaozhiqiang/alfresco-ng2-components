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

import { Directive, ElementRef, Input, OnChanges, Renderer } from '@angular/core';
import { HighlightTransformService, HightlightTransformResult } from '../services/highlight-transform.service';

@Directive({
    selector: '[adf-highlight]'
})
export class HighlightDirective implements OnChanges {

    @Input('adf-highlight-selector')
    selector: string = '';

    @Input('adf-highlight')
    search: string = '';

    @Input('adf-highlight-class')
    classToApply: string = 'adf-highlight';

    constructor(
        private el: ElementRef,
        private renderer: Renderer,
        private highlightTransformService: HighlightTransformService) { }

    ngOnChanges() {
        this.highlight();
    }

    public highlight(search = this.search, selector = this.selector, classToApply = this.classToApply) {
        if (search && selector) {
            const elements = this.el.nativeElement.querySelectorAll(selector);

            elements.forEach((element) => {
                const result: HightlightTransformResult = this.highlightTransformService.highlight(element.innerHTML, search, classToApply);
                if (result.changed) {
                    this.renderer.setElementProperty(element, 'innerHTML', result.text);
                }
            });
        }
    }
}
