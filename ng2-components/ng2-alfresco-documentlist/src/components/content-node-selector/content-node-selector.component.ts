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

import { Component, EventEmitter, Inject, Input, Optional, Output, ViewEncapsulation } from '@angular/core';
import { MD_DIALOG_DATA, MdDialogRef } from '@angular/material';
import { MinimalNodeEntryEntity, NodePaging } from 'alfresco-js-api';
import { AlfrescoTranslationService, SearchOptions, SearchService, SiteModel } from 'ng2-alfresco-core';

export interface ContentNodeSelectorComponentData {
    title: string;
    select: EventEmitter<MinimalNodeEntryEntity>;
}

@Component({
    selector: 'adf-content-node-selector',
    styleUrls: ['./content-node-selector.component.scss'],
    templateUrl: './content-node-selector.component.html',
    encapsulation: ViewEncapsulation.None
})
export class ContentNodeSelectorComponent {

    nodes: NodePaging|Array<any>;
    siteId: null|string;
    searchTerm: string = '';
    searched: boolean = false;
    inDialog: boolean = false;
    chosenNode: MinimalNodeEntryEntity | null = null;

    @Input()
    title: string;

    @Output()
    select: EventEmitter<MinimalNodeEntryEntity> = new EventEmitter<MinimalNodeEntryEntity>();

    constructor(private searchService: SearchService,
                @Optional() private translateService: AlfrescoTranslationService,
                @Optional() @Inject(MD_DIALOG_DATA) public data?: ContentNodeSelectorComponentData,
                @Optional() private containingDialog?: MdDialogRef<ContentNodeSelectorComponent>) {

        if (translateService) {
            translateService.addTranslationFolder('ng2-alfresco-documentlist', 'assets/ng2-alfresco-documentlist');
        }

        if (data) {
            this.title = data.title;
            this.select = data.select;
        }

        if (containingDialog) {
            this.inDialog = true;
        }
    }

    /**
     * Updates the site attribute and starts a new search
     *
     * @param chosenSite Sitemodel to search within
     */
    siteChanged(chosenSite: SiteModel): void {
        this.siteId = chosenSite.guid;
        this.querySearch();
    }

    /**
     * Updates the searchTerm attribute and starts a new search
     *
     * @param searchTerm string value to search against
     */
    search(searchTerm: string): void {
        this.searchTerm = searchTerm;
        this.querySearch();
    }

    /**
     * Clear the search input
     */
    clear(): void {
        this.searched = false;
        this.searchTerm = '';
        this.nodes = [];
        this.chosenNode = null;
    }

    /**
     * Perform the call to searchService with the proper parameters
     */
    private querySearch(): void {
        if (this.searchTerm.length > 3) {
            const searchTerm = this.searchTerm + '*';
            let searchOpts: SearchOptions = {
                include: ['path'],
                skipCount: 0,
                rootNodeId: this.siteId,
                nodeType: 'cm:folder',
                maxItems: 40,
                orderBy: null
            };
            this.searchService
                .getNodeQueryResults(searchTerm, searchOpts)
                .subscribe(
                    results => {
                        this.searched = true;
                        this.nodes = results;
                    }
                );
        }
    }

    /**
     * Invoked when user selects a node
     *
     * @param event CustomEvent for node-select
     */
    onNodeSelect(event: any): void {
        this.chosenNode = event.detail.node.entry;
    }

    /**
     * * Invoked when user unselects a node
     */
    onNodeUnselect(): void {
        this.chosenNode = null;
    }

    /**
     * Emit event with the chosen node
     */
    choose(): void {
        this.select.next(this.chosenNode);
    }

    /**
     * Close the dialog
     */
    close(): void {
        this.containingDialog.close();
    }
}
